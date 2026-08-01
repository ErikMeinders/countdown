"""In-memory doubles for the repository and notifier.

These let the game service be tested end to end with no AWS access. The
conditional/atomic operations are modelled straightforwardly — the tests are
single-threaded, so the interesting behaviour to reproduce is *outcome* (a
round starts once, a result records once), not concurrency.
"""

from __future__ import annotations

from typing import Any, Optional

from domain.errors import DomainError, ErrorCode
from domain.room import Player, Room, RoomStatus
from domain.round import Round, RoundStatus, Submission
from domain.scoring import wins_needed
from repositories.repository import Repository
from services.websocket_service import Notifier


class FakeNotifier(Notifier):
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    def send(self, connection_id: str, message: dict[str, Any]) -> bool:
        self.sent.append((connection_id, message))
        return True

    def messages_of_type(self, type_: str) -> list[dict[str, Any]]:
        return [m for _, m in self.sent if m.get("type") == type_]

    def last_of_type(self, type_: str) -> Optional[dict[str, Any]]:
        matches = self.messages_of_type(type_)
        return matches[-1] if matches else None


class FakeRepository(Repository):
    def __init__(self) -> None:
        self.rooms: dict[str, Room] = {}
        self.rounds: dict[tuple[str, int], Round] = {}
        self.subs: dict[tuple[str, int, str], Submission] = {}
        self.connections: dict[str, tuple[str, str, bool]] = {}

    # ── Rooms ──
    def create_room(self, room: Room) -> None:
        if room.code in self.rooms:
            raise DomainError(ErrorCode.INTERNAL_ERROR, "Room code collision.")
        self.rooms[room.code] = room

    def get_room(self, code: str) -> Optional[Room]:
        return self.rooms.get(code)

    def add_player(self, code: str, player: Player, now_epoch_s: int) -> Room:
        room = self.rooms.get(code)
        if room is None:
            raise DomainError(ErrorCode.ROOM_NOT_FOUND, "Room does not exist.")
        if room.status != RoomStatus.WAITING:
            raise DomainError(ErrorCode.ROOM_COMPLETED, "Room not accepting players.")
        if room.expires_at and room.expires_at < now_epoch_s:
            raise DomainError(ErrorCode.ROOM_EXPIRED, "Room expired.")
        if room.is_full():
            raise DomainError(ErrorCode.ROOM_FULL, "Room is full.")
        room.players[player.player_id] = player
        room.scores[player.player_id] = 0
        return room

    def set_player_ready(self, code: str, player_id: str, ready: bool) -> Room:
        room = self.rooms[code]
        if player_id not in room.players:
            raise DomainError(ErrorCode.PLAYER_NOT_FOUND, "Player not in room.")
        room.players[player_id].ready = ready
        return room

    def reset_ready(self, code: str) -> Room:
        room = self.rooms[code]
        for p in room.players.values():
            p.ready = False
        return room

    # ── Rounds ──
    def start_round(self, code: str, round_: Round) -> bool:
        key = (code, round_.number)
        if key in self.rounds:
            return False
        room = self.rooms[code]
        if room.status != RoomStatus.WAITING or room.current_round != round_.number - 1:
            return False
        self.rounds[key] = round_
        room.status = RoomStatus.PLAYING
        room.current_round = round_.number
        return True

    def get_round(self, code: str, number: int) -> Optional[Round]:
        return self.rounds.get((code, number))

    def get_submission(self, code: str, number: int, player_id: str) -> Optional[Submission]:
        return self.subs.get((code, number, player_id))

    def save_submission(self, code: str, number: int, submission: Submission) -> None:
        self.subs[(code, number, submission.player_id)] = submission

    def list_submissions(self, code: str, number: int) -> list[Submission]:
        return [v for (c, n, _), v in self.subs.items() if c == code and n == number]

    def complete_round(
        self, code: str, number: int, winner_id: Optional[str], best_of: int
    ) -> tuple[Room, bool]:
        room = self.rooms[code]
        round_ = self.rounds[(code, number)]
        if round_.status == RoundStatus.COMPLETE:
            return room, False
        round_.status = RoundStatus.COMPLETE
        round_.winner_id = winner_id
        if winner_id is not None:
            room.scores[winner_id] = room.scores.get(winner_id, 0) + 1
        if max(room.scores.values(), default=0) >= wins_needed(best_of):
            room.status = RoomStatus.COMPLETED
        else:
            room.status = RoomStatus.WAITING
        for p in room.players.values():
            p.ready = False
        return room, True

    def advance_to_next_round(self, code: str, completed_round: int) -> Room:
        return self.reset_ready(code)

    # ── Connections ──
    def register_connection(self, code: str, connection_id: str, player_id: str, ttl_epoch_s: int) -> None:
        self.connections[connection_id] = (code, player_id, True)

    def deactivate_connection(self, connection_id: str) -> Optional[tuple[str, str]]:
        entry = self.connections.get(connection_id)
        if entry is None:
            return None
        code, player_id, _ = entry
        self.connections[connection_id] = (code, player_id, False)
        room = self.rooms.get(code)
        if room and player_id in room.players:
            room.players[player_id].active = False
        return code, player_id

    def reactivate_player(
        self, code: str, connection_id: str, player_id: str, ttl_epoch_s: int
    ) -> Room:
        room = self.rooms.get(code)
        if room is None or player_id not in room.players:
            raise DomainError(ErrorCode.PLAYER_NOT_FOUND, "We couldn't find your player in this room.")
        # Retire the player's other connections, exactly as the DynamoDB
        # implementation does — otherwise the fake would let a bug through
        # where a broadcast still reaches the dead socket.
        for conn, (c, pid, active) in list(self.connections.items()):
            if c == code and pid == player_id and conn != connection_id and active:
                self.connections[conn] = (c, pid, False)
        room.players[player_id].active = True
        self.register_connection(code, connection_id, player_id, ttl_epoch_s)
        return room

    def connections_for_room(self, code: str) -> dict[str, str]:
        return {
            player_id: conn
            for conn, (c, player_id, active) in self.connections.items()
            if c == code and active
        }
