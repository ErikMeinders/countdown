// ── useMultiplayer ─────────────────────────────────────────────
// Binds the pure state machine to a transport (the real WebSocket client, or an
// injected mock/fake in dev and tests) and exposes intent-level actions. This
// is the only React surface that holds a socket; screens call the actions and
// read `state`. A transport factory can be injected for testing.

import { useCallback, useEffect, useReducer, useRef } from "react";

import { getWebSocketUrl } from "../services/config.js";
import { messages } from "../services/protocol.js";
import { WebSocketClient } from "../services/websocketClient.js";
import { createInitialState, reducer } from "./multiplayerMachine.js";

const NAME_KEY = "countdown-name";
const SESSION_KEY = "countdown-mp";

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}
function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode */
  }
}
function saveSession(session) {
  try {
    // Only non-secret reconnect hints — never tokens or logs.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* private mode */
  }
}
function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function useMultiplayer({ createTransport } = {}) {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(loadName()));
  const clientRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const ensureClient = useCallback(() => {
    if (clientRef.current) return clientRef.current;
    const onState = (s) => dispatch({ type: "CONNECTION", state: s });
    const onMessage = (m) => dispatch({ type: "SERVER", message: m });
    clientRef.current = createTransport
      ? createTransport({ onState, onMessage })
      : new WebSocketClient(getWebSocketUrl(), { onState, onMessage });
    return clientRef.current;
  }, [createTransport]);

  // Persist just enough to attempt a future reconnect (see README limitation).
  useEffect(() => {
    if (state.playerId && state.room) {
      saveSession({
        code: state.room.code,
        playerId: state.playerId,
        displayName: state.displayName,
      });
    }
  }, [state.playerId, state.room?.code, state.displayName]);

  // Close the socket if the multiplayer subtree unmounts.
  useEffect(() => () => clientRef.current?.close(), []);

  const createRoom = useCallback(
    (name, options) => {
      saveName(name);
      dispatch({ type: "SET_NAME", name });
      const client = ensureClient();
      client.connect();
      client.send(messages.createRoom(name, options));
    },
    [ensureClient]
  );

  const joinRoom = useCallback(
    (code, name) => {
      saveName(name);
      dispatch({ type: "SET_NAME", name });
      const client = ensureClient();
      client.connect();
      client.send(messages.joinRoom(code, name));
    },
    [ensureClient]
  );

  const ready = useCallback(() => {
    const s = stateRef.current;
    if (!s.room || !s.playerId) return;
    clientRef.current?.send(messages.ready(s.room.code, s.playerId));
  }, []);

  const submitAnswer = useCallback((expression, claimedResult) => {
    const s = stateRef.current;
    if (!s.room || !s.playerId || !s.round) return;
    dispatch({ type: "SUBMITTING" });
    clientRef.current?.send(
      messages.submitAnswer(s.room.code, s.playerId, s.round.roundNumber, expression, claimedResult)
    );
  }, []);

  // Nudge the backend to finalise a round whose deadline has passed but whose
  // result hasn't arrived (e.g. only one player submitted).
  const forceFinalize = useCallback(() => {
    const s = stateRef.current;
    if (!s.room || !s.playerId) return;
    clientRef.current?.send(messages.nextRound(s.room.code, s.playerId));
  }, []);

  const markAwaitingResult = useCallback(() => dispatch({ type: "AWAITING_RESULT" }), []);
  const clearError = useCallback(() => dispatch({ type: "CLEAR_ERROR" }), []);
  const reconnect = useCallback(() => ensureClient().connect(), [ensureClient]);

  const leave = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
    clearSession();
    dispatch({ type: "LEAVE" });
  }, []);

  return {
    state,
    actions: {
      createRoom,
      joinRoom,
      ready,
      submitAnswer,
      forceFinalize,
      markAwaitingResult,
      clearError,
      reconnect,
      leave,
    },
  };
}
