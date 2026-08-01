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
    // Only non-secret reconnect hints — never tokens or logs. The player ID is
    // what `reconnect` is keyed on: unguessable enough for a room that expires
    // within the hour, and not a credential, so this stays a hint rather than
    // something worth stealing.
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
    // Every time the socket opens — the first time, and after every backoff
    // retry — announce who we are if we were in a room. The server rebinds the
    // seat and replies with a snapshot; the reducer restores the phase from it.
    //
    // Driven off the socket rather than off React state on purpose: a drop is
    // a transport event, and the alternative (an effect watching
    // connectionState) fires a frame late, after the queue has already been
    // flushed at a server that doesn't know who we are.
    // Deliberately reads live state and not the stored session: on the *first*
    // open the queue already holds a createRoom or joinRoom, and a stale
    // session from an earlier room in this tab would send a reconnect ahead of
    // it — resuming a room the player has left, or erroring on one that has
    // since expired. Restoring across a page reload needs an explicit "resume
    // your room?" affordance, which is a separate piece of work.
    const onOpen = () => {
      const { room, playerId } = stateRef.current;
      if (!room || !playerId) return;
      clientRef.current?.send(messages.reconnect(room.code, playerId));
    };
    clientRef.current = createTransport
      ? createTransport({ onState, onMessage, onOpen })
      : new WebSocketClient(getWebSocketUrl(), { onState, onMessage, onOpen });
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
