from domain.scoring import (
    Submission,
    is_match_complete,
    match_winner,
    score_round,
    wins_needed,
)


def sub(pid, value, operations=1, submitted_at=1000):
    return Submission(player_id=pid, value=value, operations=operations, submitted_at=submitted_at)


def test_smallest_distance_wins():
    outcome = score_round([sub("a", 90), sub("b", 105)], target=100)
    assert outcome.winner_id == "b"  # distance 5 beats distance 10
    assert not outcome.is_tie


def test_exact_beats_non_exact():
    outcome = score_round([sub("a", 100), sub("b", 95)], target=100)
    assert outcome.winner_id == "a"


def test_fewer_operations_breaks_a_distance_tie():
    # Same value (same distance); a wins by using fewer operations.
    outcome = score_round(
        [sub("a", 98, operations=2), sub("b", 98, operations=4)], target=100
    )
    assert outcome.winner_id == "a"


def test_earlier_submission_is_the_final_tie_breaker():
    outcome = score_round(
        [
            sub("a", 98, operations=3, submitted_at=2000),
            sub("b", 98, operations=3, submitted_at=1000),
        ],
        target=100,
    )
    assert outcome.winner_id == "b"


def test_exact_tie_has_no_winner():
    outcome = score_round(
        [
            sub("a", 98, operations=3, submitted_at=1500),
            sub("b", 98, operations=3, submitted_at=1500),
        ],
        target=100,
    )
    assert outcome.is_tie
    assert outcome.winner_id is None


def test_single_submission_wins_by_default():
    outcome = score_round([sub("a", 250)], target=100)
    assert outcome.winner_id == "a"


def test_best_of_five_needs_three_wins():
    assert wins_needed(5) == 3


def test_match_completes_after_three_round_wins():
    scores = {"a": 2, "b": 1}
    assert not is_match_complete(scores, best_of=5)
    scores["a"] += 1
    assert is_match_complete(scores, best_of=5)
    assert match_winner(scores, best_of=5) == "a"


def test_match_not_complete_below_threshold():
    assert match_winner({"a": 2, "b": 2}, best_of=5) is None
