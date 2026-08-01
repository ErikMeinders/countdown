// ── Multiplayer protocol ───────────────────────────────────────
// The single source of truth for the wire contract with the backend in
// `backend/`. Action names, server message types, error codes, the message
// builders, and the parser all live here — no raw type strings scattered
// through the UI. Mirrors backend/src/protocol.py and backend/src/domain/errors.py.

let requestCounter = 0;
export function nextRequestId() {
  requestCounter += 1;
  return `c${Date.now().toString(36)}-${requestCounter}`;
}

// Outbound route names (must match the backend WebSocket routes exactly).
export const ACTIONS = Object.freeze({
  CREATE_ROOM: "createRoom",
  JOIN_ROOM: "joinRoom",
  READY: "ready",
  SUBMIT_ANSWER: "submitAnswer",
  NEXT_ROUND: "nextRound",
  PING: "ping",
});

// Inbound message `type` values.
export const SERVER = Object.freeze({
  ROOM_CREATED: "roomCreated",
  ROOM_JOINED: "roomJoined",
  PLAYER_JOINED: "playerJoined",
  READY_UPDATED: "readyUpdated",
  ROUND_STARTED: "roundStarted",
  ANSWER_ACCEPTED: "answerAccepted",
  ROUND_RESULT: "roundResult",
  ROUND_ADVANCED: "roundAdvanced",
  PLAYER_DISCONNECTED: "playerDisconnected",
  PONG: "pong",
  ERROR: "error",
});

// Stable backend error codes → human-readable, non-technical messages. Raw
// backend exceptions are never shown; unknown codes fall back to a generic line.
export const ERROR_MESSAGES = Object.freeze({
  BAD_REQUEST: "Something went wrong with that request.",
  UNKNOWN_ACTION: "Something went wrong with that request.",
  VALIDATION_ERROR: "Please check your input and try again.",
  ROOM_NOT_FOUND: "That room doesn't exist. Check the code and try again.",
  ROOM_FULL: "That room is already full.",
  ROOM_EXPIRED: "That room has expired. Start a new one.",
  ROOM_COMPLETED: "That match has already finished.",
  NOT_A_MEMBER: "You're not a player in this room.",
  PLAYER_NOT_FOUND: "We couldn't find your player in this room.",
  NAME_TAKEN: "That name is already taken in this room.",
  ROUND_NOT_FOUND: "That round doesn't exist.",
  ROUND_NOT_ACTIVE: "That round is no longer accepting answers.",
  ROUND_CLOSED: "The round deadline has passed.",
  NOT_READY: "Not everyone is ready yet.",
  MATCH_COMPLETE: "This match is already over.",
  INVALID_EXPRESSION: "That answer isn't a valid expression.",
  NUMBER_NOT_AVAILABLE: "That answer uses a number that isn't on the board.",
  INVALID_OPERATOR: "That answer uses something that isn't +, −, × or ÷.",
  ILLEGAL_INTERMEDIATE: "Every step must stay a positive whole number.",
  INTERNAL_ERROR: "The server hit a problem. Please try again.",
});

export function humanError(code, fallbackMessage) {
  return ERROR_MESSAGES[code] || fallbackMessage || "Something went wrong.";
}

// Room codes: uppercase, unambiguous alphabet, four characters (matches
// backend/src/domain/ids.py).
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{4}$`);

// Trim, uppercase, and strip anything not in the alphabet, then validate.
export function normalizeRoomCode(input) {
  const cleaned = String(input || "")
    .toUpperCase()
    .split("")
    .filter((ch) => ROOM_CODE_ALPHABET.includes(ch))
    .join("");
  return { code: cleaned, valid: ROOM_CODE_RE.test(cleaned) };
}

// ── Message builders ───────────────────────────────────────────

function build(action, payload, requestId = nextRequestId()) {
  return { action, requestId, payload };
}

export const messages = Object.freeze({
  createRoom: (displayName, { bestOf, roundSeconds } = {}) =>
    build(ACTIONS.CREATE_ROOM, { displayName, bestOf, roundSeconds }),
  joinRoom: (roomCode, displayName) => build(ACTIONS.JOIN_ROOM, { roomCode, displayName }),
  ready: (roomCode, playerId) => build(ACTIONS.READY, { roomCode, playerId }),
  submitAnswer: (roomCode, playerId, roundNumber, expression, claimedResult) =>
    build(ACTIONS.SUBMIT_ANSWER, { roomCode, playerId, roundNumber, expression, claimedResult }),
  nextRound: (roomCode, playerId) => build(ACTIONS.NEXT_ROUND, { roomCode, playerId }),
  ping: () => build(ACTIONS.PING, {}),
});

// ── Parsing ────────────────────────────────────────────────────
// Never trust an inbound frame: parse defensively and return a normalized shape
// or null. The reducer switches on `type`.
export function parseServerMessage(raw) {
  let data;
  try {
    data = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || typeof data.type !== "string") {
    return null;
  }
  return {
    type: data.type,
    requestId: typeof data.requestId === "string" ? data.requestId : null,
    payload: data.payload && typeof data.payload === "object" ? data.payload : {},
    error: data.error && typeof data.error === "object" ? data.error : null,
  };
}
