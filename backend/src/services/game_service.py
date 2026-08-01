"""Game orchestration: the one place that turns requests into state changes.

Everything here is expressed in terms of the :class:`Repository` and
:class:`Notifier` interfaces, so the whole flow — create, join, ready, start,
submit, score, advance — is unit-testable without AWS. API Gateway event shapes
never reach this layer; it works on :class:`~protocol.Request` and plain dicts.
"""

from __future__ import annotations

import logging
import time
from typing import Callable, Optional

from config import Config
from domain import scoring
from domain.errors import DomainError, ErrorCode
from domain.ids import generate_match_id, generate_player_id, generate_room_code
from domain.puzzle import generate_puzzle
from domain.room import (
    ALLOWED_BEST_OF,
    ALLOWED_ROUND_SECONDS,
    DEFAULT_BEST_OF,
    DEFAULT_CAPACITY,
    Player,
    Room,
    RoomStatus,
)
from domain.round import Round, RoundStatus
from domain.round import Submission as StoredSubmission
from domain.validation import validate_expression
from logging_config import get_logger, log
from protocol import Request, require_int, require_str, response
from repositories.repository import Repository
from services.websocket_service import Notifier

logger = get_logger(__name__)

# Give clients a short, shared lead-in so the reels can spin before the clock
# starts — the same numbers on every screen, revealed on the server's schedule.
_START_LEAD_MS = 3000

# A short grace after the deadline during which a late answer is still accepted.
# Clients auto-submit their best working the moment their local clock hits zero,
# which — after network and clock skew — usually lands just past the server's
# deadline. Without this window that final answer would be thrown away.
_SUBMIT_GRACE_MS = 3000


class GameService:
    def __init__(
        self,
        repo: Repository,
        notifier: Notifier,
        config: Config,
        clock_ms: Callable[[], int] | None = None,
    ) -> None:
        self._repo = repo
        self._notifier = notifier
        self._config = config
        self._clock_ms = clock_ms or (lambda: int(time.time() * 1000))

    # ── Connection lifecycle ───────────────────────────────────────────────

    def connect(self, connection_id: str) -> None:
        """Nothing to persist yet — the connection is claimed at create/join."""
        log(logger, logging.INFO, "connect", connectionId=connection_id)

    def disconnect(self, connection_id: str) -> None:
        result = self._repo.deactivate_connection(connection_id)
        if result is None:
            return
        code, player_id = result
        log(logger, logging.INFO, "disconnect", connectionId=connection_id, code=code)
        room = self._repo.get_room(code)
        if room is None:
            return
        self._broadcast(
            code,
            response("playerDisconnected", None, {"playerId": player_id, "room": room.public_state()}),
            exclude=player_id,
        )

    def ping(self, request: Request) -> None:
        self._send(request.connection_id, response("pong", request.request_id, {"serverTime": self._clock_ms()}))

    # ── Rooms ──────────────────────────────────────────────────────────────

    def create_room(self, request: Request) -> None:
        display_name = require_str(request.payload, "displayName", max_length=32)
        best_of = self._choice(request.payload.get("bestOf"), ALLOWED_BEST_OF, DEFAULT_BEST_OF, "bestOf")
        round_seconds = self._choice(
            request.payload.get("roundSeconds"),
            ALLOWED_ROUND_SECONDS,
            self._config.round_duration_seconds,
            "roundSeconds",
        )
        host_id = generate_player_id()
        now_ms = self._clock_ms()
        code = self._reserve_room_code()

        host = Player(
            player_id=host_id,
            display_name=display_name,
            connection_id=request.connection_id,
            is_host=True,
            joined_at=now_ms,
        )
        room = Room(
            code=code,
            match_id=generate_match_id(),
            host_player_id=host_id,
            status=RoomStatus.WAITING,
            capacity=DEFAULT_CAPACITY,
            best_of=best_of,
            round_seconds=round_seconds,
            scores={host_id: 0},
            players={host_id: host},
            created_at=now_ms,
            expires_at=self._expires_at(),
        )
        self._repo.create_room(room)
        self._repo.register_connection(code, request.connection_id, host_id, self._expires_at())
        log(logger, logging.INFO, "room created", code=code)

        self._send(
            request.connection_id,
            response(
                "roomCreated",
                request.request_id,
                {"playerId": host_id, "match": self._match_config(room), "room": room.public_state()},
            ),
        )

    def join_room(self, request: Request) -> None:
        code = require_str(request.payload, "roomCode", max_length=16).upper()
        display_name = require_str(request.payload, "displayName", max_length=32)

        room = self._require_room(code)
        self._guard_joinable(room)
        if any(p.display_name.lower() == display_name.lower() for p in room.players.values()):
            raise DomainError(ErrorCode.NAME_TAKEN, "That name is taken in this room.")

        player = Player(
            player_id=generate_player_id(),
            display_name=display_name,
            connection_id=request.connection_id,
            joined_at=self._clock_ms(),
        )
        room = self._repo.add_player(code, player, self._now_s())
        self._repo.register_connection(code, request.connection_id, player.player_id, self._expires_at())
        log(logger, logging.INFO, "player joined", code=code)

        self._send(
            request.connection_id,
            response(
                "roomJoined",
                request.request_id,
                {"playerId": player.player_id, "match": self._match_config(room), "room": room.public_state()},
            ),
        )
        self._broadcast(
            code,
            response("playerJoined", None, {"playerId": player.player_id, "room": room.public_state()}),
            exclude=player.player_id,
        )

    # ── Readiness and round start ──────────────────────────────────────────

    def ready(self, request: Request) -> None:
        code = require_str(request.payload, "roomCode", max_length=16).upper()
        player_id = require_str(request.payload, "playerId", max_length=64)
        room = self._require_membership(code, player_id)
        if room.status == RoomStatus.COMPLETED:
            raise DomainError(ErrorCode.MATCH_COMPLETE, "This match is already over.")

        room = self._repo.set_player_ready(code, player_id, True)
        self._broadcast(code, response("readyUpdated", None, {"room": room.public_state()}))

        if room.status == RoomStatus.WAITING and room.all_active_ready():
            self._start_round(room)

    def _start_round(self, room: Room) -> None:
        number = room.current_round + 1
        now_ms = self._clock_ms()
        starts_at = now_ms + _START_LEAD_MS
        ends_at = starts_at + room.round_seconds * 1000
        reveal_at = ends_at + self._config.reveal_delay_seconds * 1000
        puzzle = generate_puzzle()
        round_ = Round(
            code=room.code,
            match_id=room.match_id,
            number=number,
            numbers=puzzle.numbers,
            target=puzzle.target,
            starts_at=starts_at,
            ends_at=ends_at,
            reveal_at=reveal_at,
            status=RoundStatus.ACTIVE,
            expires_at=self._expires_at(),
        )
        # The conditional create is the single gate: only the request that
        # actually creates the round announces it, so no duplicate start.
        if self._repo.start_round(room.code, round_):
            log(logger, logging.INFO, "round started", code=room.code, round=number)
            self._broadcast(room.code, response("roundStarted", None, round_.public_definition()))

    # ── Answer submission ──────────────────────────────────────────────────

    def submit_answer(self, request: Request) -> None:
        code = require_str(request.payload, "roomCode", max_length=16).upper()
        player_id = require_str(request.payload, "playerId", max_length=64)
        round_number = require_int(request.payload, "roundNumber")
        expression = require_str(request.payload, "expression", max_length=256)
        # claimedResult is accepted but never trusted; the server computes the value.
        _claimed = request.payload.get("claimedResult")

        room = self._require_membership(code, player_id)
        round_ = self._repo.get_round(code, round_number)
        if round_ is None:
            raise DomainError(ErrorCode.ROUND_NOT_FOUND, "That round does not exist.")
        if round_.status != RoundStatus.ACTIVE:
            raise DomainError(ErrorCode.ROUND_NOT_ACTIVE, "That round is no longer accepting answers.")
        if self._clock_ms() > round_.ends_at + _SUBMIT_GRACE_MS:
            # Well past the deadline: finalise lazily and reject this late answer.
            self._finalize_round(room, round_)
            raise DomainError(ErrorCode.ROUND_CLOSED, "The round deadline has passed.")

        result = validate_expression(expression, round_.numbers)
        if not result.valid:
            raise DomainError(result.error_code or ErrorCode.INVALID_EXPRESSION, result.error_message or "Invalid expression.")

        assert result.value is not None
        submission = StoredSubmission(
            player_id=player_id,
            expression=expression,
            value=result.value,
            distance=abs(result.value - round_.target),
            operations=result.operations,
            exact=result.value == round_.target,
            submitted_at=self._clock_ms(),
        )

        existing = self._repo.get_submission(code, round_number, player_id)
        accepted = existing is None or self._is_better(submission, existing, round_.target)
        if accepted:
            self._repo.save_submission(code, round_number, submission)

        best = submission if accepted else existing
        assert best is not None
        self._send(
            request.connection_id,
            response(
                "answerAccepted",
                request.request_id,
                {"accepted": accepted, "roundNumber": round_number, "best": best.public_view()},
            ),
        )

        # Complete as soon as every active player has an answer.
        submitted = {s.player_id for s in self._repo.list_submissions(code, round_number)}
        active_ids = {p.player_id for p in room.active_players()}
        if active_ids and active_ids <= submitted:
            self._finalize_round(room, round_)

    def _finalize_round(self, room: Room, round_: Round) -> None:
        stored = self._repo.list_submissions(room.code, round_.number)
        candidates = [
            scoring.Submission(
                player_id=s.player_id,
                value=s.value,
                operations=s.operations,
                submitted_at=s.submitted_at,
                expression=s.expression,
            )
            for s in stored
        ]
        outcome = scoring.score_round(candidates, round_.target)
        updated, did_complete = self._repo.complete_round(
            room.code, round_.number, outcome.winner_id, room.best_of
        )
        if not did_complete:
            return
        log(logger, logging.INFO, "round complete", code=room.code, round=round_.number)

        match_winner = scoring.match_winner(updated.scores, updated.best_of)
        payload = {
            "roomCode": room.code,
            "roundNumber": round_.number,
            "target": round_.target,
            "numbers": round_.numbers,
            "status": RoundStatus.COMPLETE.value,
            "winnerId": outcome.winner_id,
            "isTie": outcome.is_tie,
            "submissions": [s.public_view() for s in stored],
            "scores": dict(updated.scores),
            "matchComplete": updated.status == RoomStatus.COMPLETED,
            "matchWinnerId": match_winner,
            # A future solver-generated "algorithmSolution" can be added here
            # without changing the shape of anything above.
        }
        self._broadcast(room.code, response("roundResult", None, payload))

    # ── Next round ─────────────────────────────────────────────────────────

    def next_round(self, request: Request) -> None:
        """Finalise a round whose deadline has passed — the client's timeout nudge.

        This does NOT advance the lobby. Progression to the next round happens
        when players ready up again after seeing the result (see :meth:`ready`),
        so finalising here must only produce the result and stop — otherwise the
        round result would be skipped straight back to the lobby.

        Idempotent: repeated nudges, or a nudge for a round that is already
        complete or not yet due, do nothing.
        """
        code = require_str(request.payload, "roomCode", max_length=16).upper()
        player_id = require_str(request.payload, "playerId", max_length=64)
        room = self._require_membership(code, player_id)

        round_ = self._repo.get_round(code, room.current_round)
        if round_ is None or round_.status != RoundStatus.ACTIVE:
            return
        if self._clock_ms() > round_.ends_at:
            self._finalize_round(room, round_)

    # ── Helpers ────────────────────────────────────────────────────────────

    def _reserve_room_code(self) -> str:
        for _ in range(10):
            code = generate_room_code()
            if self._repo.get_room(code) is None:
                return code
        raise DomainError(ErrorCode.INTERNAL_ERROR, "Could not allocate a room code.")

    def _require_room(self, code: str) -> Room:
        room = self._repo.get_room(code)
        if room is None:
            raise DomainError(ErrorCode.ROOM_NOT_FOUND, "The requested room does not exist.")
        return room

    def _require_membership(self, code: str, player_id: str) -> Room:
        room = self._require_room(code)
        if player_id not in room.players:
            raise DomainError(ErrorCode.NOT_A_MEMBER, "You are not a player in this room.")
        return room

    def _guard_joinable(self, room: Room) -> None:
        if room.status == RoomStatus.COMPLETED:
            raise DomainError(ErrorCode.ROOM_COMPLETED, "This match is already over.")
        if room.expires_at and room.expires_at < self._now_s():
            raise DomainError(ErrorCode.ROOM_EXPIRED, "This room has expired.")
        if room.is_full():
            raise DomainError(ErrorCode.ROOM_FULL, "This room is full.")

    @staticmethod
    def _is_better(candidate: StoredSubmission, existing: StoredSubmission, target: int) -> bool:
        def key(s: StoredSubmission) -> tuple[int, int, int, int]:
            return (abs(s.value - target), 0 if s.value == target else 1, s.operations, s.submitted_at)

        return key(candidate) < key(existing)

    def _match_config(self, room: Room) -> dict:
        return {
            "bestOf": room.best_of,
            "winsNeeded": scoring.wins_needed(room.best_of),
            "capacity": room.capacity,
            "roundSeconds": room.round_seconds,
        }

    @staticmethod
    def _choice(value, allowed: tuple[int, ...], default: int, name: str) -> int:
        """Validate an optional integer choice against an allow-list."""
        if value is None:
            return default
        if isinstance(value, bool) or not isinstance(value, int) or value not in allowed:
            raise DomainError(
                ErrorCode.VALIDATION_ERROR,
                f"'{name}' must be one of {', '.join(str(a) for a in allowed)}.",
            )
        return value

    def _broadcast(self, code: str, message: dict, exclude: Optional[str] = None) -> None:
        for player_id, connection_id in self._repo.connections_for_room(code).items():
            if player_id == exclude:
                continue
            self._send(connection_id, message)

    def send(self, connection_id: str, message: dict) -> None:
        """Send a single frame to one connection (used by the router for errors)."""
        self._notifier.send(connection_id, message)

    def _send(self, connection_id: str, message: dict) -> None:
        self._notifier.send(connection_id, message)

    def _now_s(self) -> int:
        return self._clock_ms() // 1000

    def _expires_at(self) -> int:
        return self._now_s() + self._config.room_ttl_seconds
