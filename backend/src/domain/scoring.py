"""Round scoring and match progression — pure functions over plain data.

Nothing here touches DynamoDB or API Gateway, so the comparison order and the
best-of-five bookkeeping can be unit-tested directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Submission:
    """One player's best valid answer to a round, ready for comparison."""

    player_id: str
    value: int
    operations: int
    submitted_at: int  # epoch milliseconds
    expression: str = ""

    def distance(self, target: int) -> int:
        return abs(self.value - target)

    def is_exact(self, target: int) -> bool:
        return self.value == target


@dataclass(frozen=True)
class RoundOutcome:
    """Result of scoring a round."""

    winner_id: Optional[str]
    is_tie: bool
    ranking: list[str]  # player IDs, best first


def _sort_key(submission: Submission, target: int) -> tuple[int, int, int, int]:
    """Lower is better, in the order the rules demand.

    1. smallest distance from the target;
    2. an exact answer beats a non-exact one (a distance-0 answer already sorts
       first, but the flag is kept explicit so the ordering reads as specified);
    3. fewer arithmetic operations;
    4. earlier valid submission time.
    """
    return (
        submission.distance(target),
        0 if submission.is_exact(target) else 1,
        submission.operations,
        submission.submitted_at,
    )


def score_round(submissions: list[Submission], target: int) -> RoundOutcome:
    """Rank submissions and pick a winner, handling exact ties explicitly."""
    if not submissions:
        return RoundOutcome(winner_id=None, is_tie=False, ranking=[])

    ranked = sorted(submissions, key=lambda s: _sort_key(s, target))
    ranking = [s.player_id for s in ranked]

    if len(ranked) >= 2 and _sort_key(ranked[0], target) == _sort_key(ranked[1], target):
        # Indistinguishable on every tie-breaker: a genuine draw, nobody scores.
        return RoundOutcome(winner_id=None, is_tie=True, ranking=ranking)

    return RoundOutcome(winner_id=ranked[0].player_id, is_tie=False, ranking=ranking)


def wins_needed(best_of: int) -> int:
    """Round wins required to take the match (3 for a best-of-five)."""
    return best_of // 2 + 1


def is_match_complete(scores: dict[str, int], best_of: int) -> bool:
    """True once any player has reached the winning number of round wins."""
    if not scores:
        return False
    return max(scores.values()) >= wins_needed(best_of)


def match_winner(scores: dict[str, int], best_of: int) -> Optional[str]:
    """The player who has won the match, or None if it is still in progress."""
    need = wins_needed(best_of)
    for player_id, wins in scores.items():
        if wins >= need:
            return player_id
    return None
