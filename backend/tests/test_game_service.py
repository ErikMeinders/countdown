"""End-to-end game-service tests against in-memory doubles — no AWS."""

import pytest

from config import Config
from domain.errors import DomainError, ErrorCode
from protocol import Request
from services.game_service import GameService
from fakes import FakeNotifier, FakeRepository


class Harness:
    """Drives a two-player match with a controllable clock."""

    def __init__(self):
        self.now = [1_000_000]  # epoch ms, advanced by the tests
        self.repo = FakeRepository()
        self.notifier = FakeNotifier()
        self.config = Config(
            table_name="t",
            environment="test",
            room_ttl_seconds=86_400,
            log_level="INFO",
            round_duration_seconds=45,
            reveal_delay_seconds=3,
        )
        self.game = GameService(self.repo, self.notifier, self.config, clock_ms=lambda: self.now[0])

    def req(self, conn, action, payload, request_id="req"):
        return Request(connection_id=conn, action=action, request_id=request_id, payload=payload)

    def create(self, conn, name):
        self.game.create_room(self.req(conn, "createRoom", {"displayName": name}))
        msg = self.notifier.last_of_type("roomCreated")
        return msg["payload"]["room"]["code"], msg["payload"]["playerId"]

    def join(self, conn, code, name):
        self.game.join_room(self.req(conn, "joinRoom", {"roomCode": code, "displayName": name}))
        return self.notifier.last_of_type("roomJoined")["payload"]["playerId"]

    def ready(self, conn, code, player_id):
        self.game.ready(self.req(conn, "ready", {"roomCode": code, "playerId": player_id}))

    def submit(self, conn, code, player_id, round_number, expression):
        self.game.submit_answer(
            self.req(
                conn,
                "submitAnswer",
                {
                    "roomCode": code,
                    "playerId": player_id,
                    "roundNumber": round_number,
                    "expression": expression,
                    "claimedResult": 0,  # deliberately wrong; must be ignored
                },
            )
        )


def test_create_join_and_round_start():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")

    h.ready("connA", code, a)
    h.ready("connB", code, b)

    started = h.notifier.last_of_type("roundStarted")
    assert started is not None
    payload = started["payload"]
    assert payload["roundNumber"] == 1
    assert len(payload["numbers"]) == 6
    assert 101 <= payload["target"] <= 999
    assert payload["startsAt"] < payload["endsAt"] <= payload["revealAt"]
    # Both connections were told the same round.
    conns = {conn for conn, m in h.notifier.sent if m.get("type") == "roundStarted"}
    assert conns == {"connA", "connB"}


def test_create_room_accepts_best_of_and_round_seconds():
    h = Harness()
    h.game.create_room(h.req("connA", "createRoom", {"displayName": "Alice", "bestOf": 3, "roundSeconds": 60}))
    payload = h.notifier.last_of_type("roomCreated")["payload"]
    assert payload["match"]["bestOf"] == 3
    assert payload["match"]["winsNeeded"] == 2
    assert payload["match"]["roundSeconds"] == 60


def test_create_room_rejects_invalid_choices():
    h = Harness()
    with pytest.raises(DomainError) as exc:
        h.game.create_room(h.req("connA", "createRoom", {"displayName": "Alice", "bestOf": 4}))
    assert exc.value.code == ErrorCode.VALIDATION_ERROR


def test_join_rejects_a_full_room():
    h = Harness()
    code, _ = h.create("connA", "Alice")
    h.join("connB", code, "Bob")
    with pytest.raises(DomainError) as exc:
        h.join("connC", code, "Carol")
    assert exc.value.code == ErrorCode.ROOM_FULL


def test_submit_rejects_an_unavailable_number():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")
    h.ready("connA", code, a)
    h.ready("connB", code, b)

    with pytest.raises(DomainError) as exc:
        # 999 is never a Countdown tile, so it cannot appear in the puzzle.
        h.submit("connA", code, a, 1, "999")
    assert exc.value.code == ErrorCode.NUMBER_NOT_AVAILABLE


def test_claimed_result_is_ignored_and_answer_accepted():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")
    h.ready("connA", code, a)
    h.ready("connB", code, b)
    numbers = h.notifier.last_of_type("roundStarted")["payload"]["numbers"]

    h.submit("connA", code, a, 1, str(numbers[0]))
    accepted = h.notifier.last_of_type("answerAccepted")
    assert accepted["payload"]["accepted"] is True
    assert accepted["payload"]["best"]["value"] == numbers[0]


def _win_a_round_for_a(h, code, a, b):
    """Alice alone answers; the deadline lapses; Alice takes the round."""
    h.ready("connA", code, a)
    h.ready("connB", code, b)
    started = h.notifier.last_of_type("roundStarted")["payload"]
    numbers = started["numbers"]
    round_number = started["roundNumber"]
    h.submit("connA", code, a, round_number, str(numbers[0]))
    # Push time past the deadline, then advance — this finalises the round.
    h.now[0] = started["endsAt"] + 1
    h.game.next_round(h.req("connA", "nextRound", {"roomCode": code, "playerId": a}))
    return h.notifier.last_of_type("roundResult")["payload"]


def test_full_match_completes_after_three_wins():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")

    for expected_round in (1, 2, 3):
        result = _win_a_round_for_a(h, code, a, b)
        assert result["roundNumber"] == expected_round
        assert result["winnerId"] == a
        assert result["scores"][a] == expected_round

    assert result["matchComplete"] is True
    assert result["matchWinnerId"] == a

    # The match is over: readying up again is refused, not silently restarted.
    with pytest.raises(DomainError) as exc:
        h.ready("connA", code, a)
    assert exc.value.code == ErrorCode.MATCH_COMPLETE


def test_timeout_finalizes_and_shows_result_without_jumping_to_lobby():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")
    h.ready("connA", code, a)
    h.ready("connB", code, b)
    started = h.notifier.last_of_type("roundStarted")["payload"]
    h.submit("connA", code, a, started["roundNumber"], str(started["numbers"][0]))

    # Deadline passes; a client sends the timeout nudge.
    h.now[0] = started["endsAt"] + 1
    h.game.next_round(h.req("connA", "nextRound", {"roomCode": code, "playerId": a}))

    # The result goes out, and the lobby is NOT advanced — otherwise the result
    # screen would be skipped straight back to the lobby.
    assert h.notifier.last_of_type("roundResult") is not None
    assert h.notifier.last_of_type("roundAdvanced") is None
    assert h.repo.get_room(code).status.value == "WAITING"


def test_next_round_nudge_before_the_deadline_is_a_no_op():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")
    h.ready("connA", code, a)
    h.ready("connB", code, b)
    # Still mid-round: a stray nudge must not finalise anything.
    h.game.next_round(h.req("connA", "nextRound", {"roomCode": code, "playerId": a}))
    assert h.notifier.last_of_type("roundResult") is None


def test_answer_submitted_just_past_the_deadline_is_still_counted():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")
    h.ready("connA", code, a)
    h.ready("connB", code, b)
    started = h.notifier.last_of_type("roundStarted")["payload"]

    # Just past the deadline but within the grace window — the auto-submitted
    # best answer must still be accepted, not thrown away.
    h.now[0] = started["endsAt"] + 1000
    h.submit("connA", code, a, started["roundNumber"], str(started["numbers"][0]))
    assert h.notifier.last_of_type("answerAccepted")["payload"]["accepted"] is True


def test_disconnect_marks_player_inactive_and_notifies_others():
    h = Harness()
    code, a = h.create("connA", "Alice")
    b = h.join("connB", code, "Bob")

    h.game.disconnect("connB")

    room = h.repo.get_room(code)
    assert room.players[b].active is False
    assert room.players[a].active is True  # the other player survives
    notice = h.notifier.last_of_type("playerDisconnected")
    assert notice["payload"]["playerId"] == b
