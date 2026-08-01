// ── WebSocket client ───────────────────────────────────────────
// The one place that touches a raw WebSocket. UI never does. It owns the socket
// lifecycle, a bounded-backoff reconnect, request/response correlation by
// requestId, defensive parsing, and a keepalive ping. Connection state is
// surfaced through a single callback so the state machine can model it.
//
// A socket factory can be injected for tests; in the app it defaults to the
// browser's native WebSocket.

import { messages, nextRequestId, parseServerMessage } from "./protocol.js";

export const ConnectionState = Object.freeze({
  IDLE: "idle",
  CONNECTING: "connecting",
  CONNECTED: "connected",
  RECONNECTING: "reconnecting",
  DISCONNECTED: "disconnected",
  ERROR: "error",
});

const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 800;
const REQUEST_TIMEOUT_MS = 10000;
const KEEPALIVE_MS = 4 * 60 * 1000; // under API Gateway's 10-minute idle cap

export class WebSocketClient {
  constructor(url, { onState, onMessage, socketFactory } = {}) {
    this._url = url;
    this._onState = onState || (() => {});
    this._onMessage = onMessage || (() => {});
    this._socketFactory = socketFactory || ((u) => new WebSocket(u));

    this._socket = null;
    this._state = ConnectionState.IDLE;
    this._intentionalClose = false;
    this._attempts = 0;
    this._reconnectTimer = null;
    this._keepaliveTimer = null;
    this._queue = [];
    this._pending = new Map(); // requestId -> { resolve, reject, timer }
  }

  get state() {
    return this._state;
  }

  connect() {
    this._intentionalClose = false;
    this._open();
  }

  _open() {
    this._setState(this._attempts > 0 ? ConnectionState.RECONNECTING : ConnectionState.CONNECTING);
    let socket;
    try {
      socket = this._socketFactory(this._url);
    } catch (err) {
      this._setState(ConnectionState.ERROR);
      this._scheduleReconnect();
      return;
    }
    this._socket = socket;

    // Fresh handlers on each socket instance — the old socket is discarded, so
    // listeners never stack up.
    socket.onopen = () => {
      this._attempts = 0;
      this._setState(ConnectionState.CONNECTED);
      this._flushQueue();
      this._startKeepalive();
    };
    socket.onmessage = (event) => this._handleMessage(event.data);
    socket.onerror = () => {
      if (this._state !== ConnectionState.CONNECTED) this._setState(ConnectionState.ERROR);
    };
    socket.onclose = () => {
      this._stopKeepalive();
      if (this._intentionalClose) {
        this._setState(ConnectionState.DISCONNECTED);
        return;
      }
      this._scheduleReconnect();
    };
  }

  _handleMessage(raw) {
    const message = parseServerMessage(raw);
    if (!message) return; // malformed frames are dropped, never thrown
    // Resolve a correlated request, if any — but always forward to the app so
    // broadcasts (no requestId) and state updates flow through one path.
    if (message.requestId && this._pending.has(message.requestId)) {
      const entry = this._pending.get(message.requestId);
      clearTimeout(entry.timer);
      this._pending.delete(message.requestId);
      entry.resolve(message);
    }
    this._onMessage(message);
  }

  // Send a pre-built {action, requestId, payload} message. Returns its
  // requestId. Queues if the socket isn't open yet.
  send(message) {
    const requestId = message.requestId || nextRequestId();
    const framed = { ...message, requestId };
    const data = JSON.stringify(framed);
    if (this._socket && this._socket.readyState === 1 /* OPEN */) {
      this._socket.send(data);
    } else {
      this._queue.push(data);
    }
    return requestId;
  }

  // Send and resolve when a frame with the same requestId returns (success or
  // error type), or reject on timeout.
  request(message) {
    const requestId = message.requestId || nextRequestId();
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId);
        reject(new Error("Request timed out"));
      }, REQUEST_TIMEOUT_MS);
      this._pending.set(requestId, { resolve, reject, timer });
    });
    this.send({ ...message, requestId });
    return promise;
  }

  _flushQueue() {
    while (this._queue.length && this._socket && this._socket.readyState === 1) {
      this._socket.send(this._queue.shift());
    }
  }

  _startKeepalive() {
    this._stopKeepalive();
    this._keepaliveTimer = setInterval(() => this.send(messages.ping()), KEEPALIVE_MS);
  }

  _stopKeepalive() {
    if (this._keepaliveTimer) clearInterval(this._keepaliveTimer);
    this._keepaliveTimer = null;
  }

  _scheduleReconnect() {
    if (this._intentionalClose) return;
    this._setState(ConnectionState.RECONNECTING);
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** this._attempts);
    const jitter = Math.random() * 0.3 * delay;
    this._attempts += 1;
    this._reconnectTimer = setTimeout(() => this._open(), delay + jitter);
  }

  // Explicit leave: stop reconnecting, close the socket, drop pending work.
  close() {
    this._intentionalClose = true;
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._stopKeepalive();
    this._queue = [];
    for (const entry of this._pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error("Connection closed"));
    }
    this._pending.clear();
    if (this._socket) {
      try {
        this._socket.close();
      } catch {
        /* already closing */
      }
    }
    this._socket = null;
    this._setState(ConnectionState.DISCONNECTED);
  }

  _setState(state) {
    if (state === this._state) return;
    this._state = state;
    this._onState(state);
  }
}
