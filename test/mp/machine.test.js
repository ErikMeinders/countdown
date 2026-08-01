import { describe, expect, it } from "vitest";

import {
  createInitialState,
  Phase,
  reducer,
  SubmissionState,
} from "../../src/state/multiplayerMachine.js";

const srv = (type, payload = {}, error = null) => ({ type: "SERVER", message: { type, payload, error } });

const room = { code: "AB7D", players: [{ playerId: "you", ready: false, active: true }], scores: { you: 0 } };

describe("multiplayer reducer", () => {
  it("enters the lobby on roomCreated", () => {
    const s = reducer(createInitialState("Erik"), srv("roomCreated", { playerId: "you", room, match: { bestOf: 5 } }));
    expect(s.phase).toBe(Phase.LOBBY);
    expect(s.playerId).toBe("you");
    expect(s.match.bestOf).toBe(5);
  });

  it("moves to playing and resets submission on roundStarted", () => {
    let s = reducer(createInitialState(), srv("roomCreated", { playerId: "you", room, match: {} }));
    s = reducer(s, srv("roundStarted", { roundNumber: 1, numbers: [1], target: 5, startsAt: 0, endsAt: 1 }));
    expect(s.phase).toBe(Phase.PLAYING);
    expect(s.round.roundNumber).toBe(1);
    expect(s.submission.state).toBe(SubmissionState.IDLE);
  });

  it("distinguishes accepted from improved", () => {
    let s = reducer(createInitialState(), srv("roundStarted", { roundNumber: 1 }));
    s = reducer(s, srv("answerAccepted", { accepted: true, best: { value: 10 } }));
    expect(s.submission.state).toBe(SubmissionState.ACCEPTED);
    s = reducer(s, srv("answerAccepted", { accepted: true, best: { value: 12 } }));
    expect(s.submission.state).toBe(SubmissionState.IMPROVED);
  });

  it("routes a submit-time error onto the submission, not the whole screen", () => {
    let s = reducer(createInitialState(), srv("roundStarted", { roundNumber: 1 }));
    s = reducer(s, { type: "SUBMITTING" });
    s = reducer(s, srv("error", {}, { code: "NUMBER_NOT_AVAILABLE" }));
    expect(s.submission.state).toBe(SubmissionState.REJECTED);
    expect(s.error).toBeNull();
    expect(s.submission.error).toMatch(/isn't on the board/i);
  });

  it("shows a general error otherwise", () => {
    const s = reducer(createInitialState(), srv("error", {}, { code: "ROOM_FULL" }));
    expect(s.error.code).toBe("ROOM_FULL");
  });

  it("goes to roundResult, then matchComplete, updating scores", () => {
    let s = reducer(createInitialState(), srv("roomCreated", { playerId: "you", room, match: {} }));
    s = reducer(s, srv("roundResult", { winnerId: "you", scores: { you: 1 }, matchComplete: false }));
    expect(s.phase).toBe(Phase.ROUND_RESULT);
    expect(s.room.scores.you).toBe(1);
    s = reducer(s, srv("roundResult", { winnerId: "you", scores: { you: 3 }, matchComplete: true, matchWinnerId: "you" }));
    expect(s.phase).toBe(Phase.MATCH_COMPLETE);
  });

  it("resets readiness on roundResult so 'Next round' reappears", () => {
    const readyRoom = { code: "AB7D", players: [{ playerId: "you", ready: true, active: true }], scores: { you: 0 } };
    let s = reducer(createInitialState(), srv("roomCreated", { playerId: "you", room: readyRoom, match: {} }));
    s = reducer(s, srv("roundResult", { winnerId: "you", scores: { you: 1 }, matchComplete: false }));
    expect(s.room.players.every((p) => !p.ready)).toBe(true);
  });

  it("leaving resets the room but keeps the display name", () => {
    let s = reducer(createInitialState("Erik"), srv("roomCreated", { playerId: "you", room, match: {} }));
    s = reducer(s, { type: "LEAVE" });
    expect(s.phase).toBe(Phase.NOT_IN_ROOM);
    expect(s.room).toBeNull();
    expect(s.displayName).toBe("Erik");
  });

  // ── Reconnect ────────────────────────────────────────────────
  // roomState is a whole-room snapshot; the phase it implies is worked out
  // here, so these cases pin the derivation rather than the wire format.

  const snapshot = (over = {}) => ({
    playerId: "you",
    match: { bestOf: 5 },
    room,
    serverTime: 1000,
    round: null,
    submission: null,
    result: null,
    ...over,
  });

  it("resumes into the lobby when nothing is in flight", () => {
    const s = reducer(createInitialState("Erik"), srv("roomState", snapshot()));
    expect(s.phase).toBe(Phase.LOBBY);
    expect(s.playerId).toBe("you");
    expect(s.room.code).toBe("AB7D");
  });

  it("resumes into a live round, keeping its own best answer", () => {
    const s = reducer(
      createInitialState(),
      srv("roomState", snapshot({
        round: { roundNumber: 2, target: 500, numbers: [1], status: "ACTIVE", startsAt: 0, endsAt: 9 },
        submission: { expression: "75+50", value: 125 },
      }))
    );
    expect(s.phase).toBe(Phase.PLAYING);
    expect(s.round.roundNumber).toBe(2);
    expect(s.submission.state).toBe(SubmissionState.ACCEPTED);
    expect(s.submission.best.expression).toBe("75+50");
  });

  it("resumes into a result the client was offline for", () => {
    const s = reducer(
      createInitialState(),
      srv("roomState", snapshot({
        round: { roundNumber: 1, status: "COMPLETE" },
        result: { roundNumber: 1, winnerId: "them", scores: { you: 0 }, matchComplete: false },
      }))
    );
    expect(s.phase).toBe(Phase.ROUND_RESULT);
    expect(s.result.winnerId).toBe("them");
    // A completed round must not be restored as the live one, or the board
    // comes back with a dead clock on it.
    expect(s.round).toBeNull();
  });

  it("resumes into matchComplete when the match ended while away", () => {
    const s = reducer(
      createInitialState(),
      srv("roomState", snapshot({
        room: { ...room, status: "COMPLETED" },
        result: { roundNumber: 3, matchComplete: true, matchWinnerId: "them", scores: { you: 1 } },
      }))
    );
    expect(s.phase).toBe(Phase.MATCH_COMPLETE);
  });

  it("clears a stale error when the snapshot arrives", () => {
    let s = reducer(createInitialState(), { type: "LOCAL_ERROR", error: { message: "Lost connection" } });
    s = reducer(s, srv("roomState", snapshot()));
    expect(s.error).toBeNull();
  });

  it("updates the roster when the opponent reconnects", () => {
    const back = { ...room, players: [{ playerId: "them", ready: false, active: true }] };
    let s = reducer(createInitialState(), srv("roomCreated", { playerId: "you", room, match: {} }));
    s = reducer(s, srv("playerReconnected", { playerId: "them", room: back }));
    expect(s.room.players[0].active).toBe(true);
  });
});
