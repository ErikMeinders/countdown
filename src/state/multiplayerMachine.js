// ── Multiplayer state machine ──────────────────────────────────
// A pure reducer modelling the multiplayer lifecycle. Keeping it here — free of
// React and of the socket — makes the transitions explicit and unit-testable,
// and keeps illegal states hard to reach: server messages are the only way to
// move between the room phases.

import { humanError, SERVER } from "../services/protocol.js";

export const Phase = Object.freeze({
  NOT_IN_ROOM: "notInRoom",
  LOBBY: "lobby",
  PLAYING: "playing",
  AWAITING_RESULT: "awaitingResult",
  ROUND_RESULT: "roundResult",
  MATCH_COMPLETE: "matchComplete",
});

export const SubmissionState = Object.freeze({
  IDLE: "idle",
  SUBMITTING: "submitting",
  ACCEPTED: "accepted",
  IMPROVED: "improved",
  REJECTED: "rejected",
});

export function createInitialState(displayName = "") {
  return {
    connectionState: "idle",
    phase: Phase.NOT_IN_ROOM,
    displayName,
    playerId: null,
    room: null,
    match: null,
    round: null,
    submission: { state: SubmissionState.IDLE, best: null, error: null },
    result: null,
    error: null,
  };
}

const resetSubmission = () => ({ state: SubmissionState.IDLE, best: null, error: null });

export function reducer(state, action) {
  switch (action.type) {
    case "CONNECTION":
      return { ...state, connectionState: action.state };

    case "SET_NAME":
      return { ...state, displayName: action.name };

    case "SUBMITTING":
      return {
        ...state,
        submission: { ...state.submission, state: SubmissionState.SUBMITTING, error: null },
      };

    case "AWAITING_RESULT":
      return state.phase === Phase.PLAYING ? { ...state, phase: Phase.AWAITING_RESULT } : state;

    case "LOCAL_ERROR":
      return { ...state, error: action.error };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "LEAVE":
      return { ...createInitialState(state.displayName), connectionState: "disconnected" };

    case "SERVER":
      return applyServer(state, action.message);

    default:
      return state;
  }
}

function applyServer(state, message) {
  const { type, payload, error } = message;
  switch (type) {
    case SERVER.ROOM_CREATED:
    case SERVER.ROOM_JOINED:
      return {
        ...state,
        error: null,
        phase: Phase.LOBBY,
        playerId: payload.playerId,
        room: payload.room,
        match: payload.match,
      };

    // A whole-room snapshot, in reply to `reconnect`. The phase is derived
    // here rather than sent by the server: the server knows the room's state,
    // but which screen that means is a client concern, and it is already
    // spelled out in this file for the live path.
    case SERVER.ROOM_STATE: {
      const { room, match, round, submission, result, playerId } = payload;
      const matchComplete = result?.matchComplete || room?.status === "COMPLETED";
      let phase = Phase.LOBBY;
      if (matchComplete) phase = Phase.MATCH_COMPLETE;
      else if (result) phase = Phase.ROUND_RESULT;
      else if (round && round.status === "ACTIVE") phase = Phase.PLAYING;

      return {
        ...state,
        error: null,
        phase,
        playerId: playerId || state.playerId,
        room: room || state.room,
        match: match || state.match,
        // Only a live round is worth restoring; a completed one is described
        // by `result`, and keeping it would leave a dead clock on screen.
        round: phase === Phase.PLAYING ? round : null,
        result: result || null,
        // Their own best answer survives the drop, so the round doesn't look
        // like it was thrown away — but it is `accepted`, not `submitting`.
        submission: submission
          ? { state: SubmissionState.ACCEPTED, best: submission, error: null }
          : resetSubmission(),
      };
    }

    case SERVER.PLAYER_JOINED:
    case SERVER.READY_UPDATED:
    case SERVER.PLAYER_RECONNECTED:
    case SERVER.PLAYER_DISCONNECTED:
      return { ...state, room: payload.room || state.room };

    case SERVER.ROUND_STARTED:
      return {
        ...state,
        phase: Phase.PLAYING,
        round: payload,
        result: null,
        submission: resetSubmission(),
        error: null,
      };

    case SERVER.ANSWER_ACCEPTED: {
      const hadBest = state.submission.best !== null;
      const nextState = payload.accepted
        ? hadBest
          ? SubmissionState.IMPROVED
          : SubmissionState.ACCEPTED
        : SubmissionState.ACCEPTED; // kept the previous, still officially accepted
      return {
        ...state,
        submission: { state: nextState, best: payload.best || state.submission.best, error: null },
      };
    }

    case SERVER.ROUND_RESULT:
      return {
        ...state,
        result: payload,
        phase: payload.matchComplete ? Phase.MATCH_COMPLETE : Phase.ROUND_RESULT,
        room: state.room
          ? {
              ...state.room,
              scores: payload.scores || state.room.scores,
              // The backend clears readiness when a round completes, but the
              // result frame carries only scores. Mirror the reset so the
              // "Next round" control reappears instead of the screen thinking
              // we're already ready for the next round.
              players: (state.room.players || []).map((p) => ({ ...p, ready: false })),
            }
          : state.room,
      };

    case SERVER.ROUND_ADVANCED:
      return {
        ...state,
        phase: Phase.LOBBY,
        room: payload.room || state.room,
        round: null,
        result: null,
        submission: resetSubmission(),
      };

    case SERVER.ERROR: {
      const code = error?.code;
      const human = humanError(code, error?.message);
      // An error mid-submit belongs on the submission, not the whole screen.
      if (state.submission.state === SubmissionState.SUBMITTING) {
        return {
          ...state,
          submission: { ...state.submission, state: SubmissionState.REJECTED, error: human },
        };
      }
      return { ...state, error: { code, message: human } };
    }

    case SERVER.PONG:
    default:
      return state;
  }
}
