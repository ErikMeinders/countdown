"""Round and submission domain models.

The round is generated and persisted server-side *before* any client displays
it, so the animation on a phone can never influence the numbers or target. A
submission is a player's best valid answer so far in a round.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class RoundStatus(str, Enum):
    ACTIVE = "ACTIVE"
    COMPLETE = "COMPLETE"


@dataclass
class Submission:
    """A player's stored best answer for a round."""

    player_id: str
    expression: str
    value: int
    distance: int
    operations: int
    exact: bool
    submitted_at: int  # epoch milliseconds

    def public_view(self) -> dict:
        return {
            "playerId": self.player_id,
            "expression": self.expression,
            "value": self.value,
            "distance": self.distance,
            "operations": self.operations,
            "exact": self.exact,
            "submittedAt": self.submitted_at,
        }


@dataclass
class Round:
    """One round of a match."""

    code: str
    match_id: str
    number: int
    numbers: list[int]
    target: int
    starts_at: int  # epoch milliseconds
    ends_at: int  # epoch milliseconds
    reveal_at: int  # epoch milliseconds — when clients may reveal the answer
    status: RoundStatus = RoundStatus.ACTIVE
    winner_id: Optional[str] = None
    submissions: dict[str, Submission] = field(default_factory=dict)
    expires_at: int = 0  # epoch seconds; DynamoDB TTL

    def public_definition(self) -> dict:
        """The round as sent to clients at the start — never leaks submissions."""
        return {
            "roomCode": self.code,
            "matchId": self.match_id,
            "roundNumber": self.number,
            "numbers": list(self.numbers),
            "target": self.target,
            "startsAt": self.starts_at,
            "endsAt": self.ends_at,
            "revealAt": self.reveal_at,
            "status": self.status.value,
        }
