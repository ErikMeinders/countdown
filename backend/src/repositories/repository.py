"""The repository interface the domain and services depend on.

Defining this as an abstract base lets the game service be exercised against a
plain in-memory fake in the unit tests, with no AWS access, while production
uses :class:`~repositories.dynamodb_repository.DynamoDbRepository`.

The conditional/atomic operations the game needs — claiming the last room slot,
starting a round exactly once, recording the first completed result — are
expressed as named methods here so their race-safety lives with the storage
implementation rather than leaking into game logic.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from domain.room import Player, Room
from domain.round import Round, Submission


class Repository(ABC):
    # ── Rooms ──────────────────────────────────────────────────────────────

    @abstractmethod
    def create_room(self, room: Room) -> None:
        """Persist a brand-new room and its host player."""

    @abstractmethod
    def get_room(self, code: str) -> Optional[Room]:
        """Load a room aggregate (metadata + players) by code, or None."""

    @abstractmethod
    def add_player(self, code: str, player: Player, now_epoch_s: int) -> Room:
        """Atomically add a player to the last free slot.

        Raises :class:`DomainError` if the room is missing, expired, full, or no
        longer accepting players. Returns the updated room.
        """

    @abstractmethod
    def set_player_ready(self, code: str, player_id: str, ready: bool) -> Room:
        """Set one player's ready flag; returns the updated room."""

    @abstractmethod
    def reset_ready(self, code: str) -> Room:
        """Clear every player's ready flag (between rounds)."""

    # ── Rounds ─────────────────────────────────────────────────────────────

    @abstractmethod
    def start_round(self, code: str, round_: Round) -> bool:
        """Atomically move the room into a round and create it exactly once.

        Returns True if this call created the round, False if another request
        won the race (the round already exists).
        """

    @abstractmethod
    def get_round(self, code: str, number: int) -> Optional[Round]:
        """Load a round (with its submissions) by number, or None."""

    @abstractmethod
    def get_submission(self, code: str, number: int, player_id: str) -> Optional[Submission]:
        """Load a single player's stored submission for a round, or None."""

    @abstractmethod
    def save_submission(self, code: str, number: int, submission: Submission) -> None:
        """Store (overwrite) a player's best submission for a round."""

    @abstractmethod
    def list_submissions(self, code: str, number: int) -> list[Submission]:
        """All stored submissions for a round."""

    @abstractmethod
    def complete_round(
        self, code: str, number: int, winner_id: Optional[str], best_of: int
    ) -> tuple[Room, bool]:
        """Record a round result exactly once.

        Atomically flips the round to COMPLETE, credits the winner, and — if the
        match is now decided — marks the room COMPLETED. Returns the updated
        room and a flag that is True only for the caller that actually recorded
        the result (so only it broadcasts).
        """

    @abstractmethod
    def advance_to_next_round(self, code: str, completed_round: int) -> Room:
        """Clear readiness so the room is a lobby for the next round."""

    # ── Connections ────────────────────────────────────────────────────────

    @abstractmethod
    def register_connection(
        self, code: str, connection_id: str, player_id: str, ttl_epoch_s: int
    ) -> None:
        """Record the connection <-> player mapping (indexed for reverse lookup)."""

    @abstractmethod
    def deactivate_connection(self, connection_id: str) -> Optional[tuple[str, str]]:
        """Mark a connection inactive on ``$disconnect``.

        Uses the connection GSI to find the owning room and player. Returns
        ``(room_code, player_id)`` if found, else None. Does not delete the
        player or room — reconnect stays possible until the room's TTL expires.
        """

    @abstractmethod
    def connections_for_room(self, code: str) -> dict[str, str]:
        """Active ``player_id -> connection_id`` map, for broadcasting."""
