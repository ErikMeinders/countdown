"""Room and player domain models.

A *room* is the aggregate that holds one best-of-five match: its players, its
running score, and its status. These are plain dataclasses with light helpers;
persistence mapping lives in the repository so the domain stays independent of
DynamoDB.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class RoomStatus(str, Enum):
    """Lifecycle of a room.

    WAITING  – players are joining or readying up between rounds.
    PLAYING  – a round is live.
    COMPLETED – the match has a winner; no further play.
    """

    WAITING = "WAITING"
    PLAYING = "PLAYING"
    COMPLETED = "COMPLETED"


# Two active players for the first version; the model carries a capacity so the
# same code supports more later without a schema change.
DEFAULT_CAPACITY = 2
DEFAULT_BEST_OF = 5
DEFAULT_ROUND_SECONDS = 45

# The room creator may choose from these; anything else is rejected.
ALLOWED_BEST_OF = (3, 5, 7)
ALLOWED_ROUND_SECONDS = (30, 45, 60)


@dataclass
class Player:
    """A participant in a room."""

    player_id: str
    display_name: str
    connection_id: str | None = None
    is_host: bool = False
    ready: bool = False
    active: bool = True
    joined_at: int = 0


@dataclass
class Room:
    """A room hosting a single best-of-five match."""

    code: str
    match_id: str
    host_player_id: str
    status: RoomStatus = RoomStatus.WAITING
    capacity: int = DEFAULT_CAPACITY
    best_of: int = DEFAULT_BEST_OF
    round_seconds: int = DEFAULT_ROUND_SECONDS
    current_round: int = 0
    scores: dict[str, int] = field(default_factory=dict)
    players: dict[str, Player] = field(default_factory=dict)
    created_at: int = 0
    expires_at: int = 0  # epoch seconds; also the DynamoDB TTL

    def active_players(self) -> list[Player]:
        return [p for p in self.players.values() if p.active]

    def is_full(self) -> bool:
        return len(self.players) >= self.capacity

    def all_active_ready(self) -> bool:
        active = self.active_players()
        return len(active) >= 2 and all(p.ready for p in active)

    def public_state(self) -> dict:
        """A client-safe view of the room — no connection IDs or tokens."""
        return {
            "code": self.code,
            "matchId": self.match_id,
            "status": self.status.value,
            "capacity": self.capacity,
            "bestOf": self.best_of,
            "currentRound": self.current_round,
            "hostPlayerId": self.host_player_id,
            "scores": dict(self.scores),
            "players": [
                {
                    "playerId": p.player_id,
                    "displayName": p.display_name,
                    "isHost": p.is_host,
                    "ready": p.ready,
                    "active": p.active,
                }
                for p in self.players.values()
            ],
        }
