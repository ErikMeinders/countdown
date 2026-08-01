// ── Dev mock transport ─────────────────────────────────────────
// A stand-in for the WebSocket client that plays the part of the backend *and*
// a second player, so the multiplayer UI can be walked end to end in one
// browser with no deployment. Enabled only in dev via `?mock=1` — never bundled
// into a production run's behaviour.
//
// It implements the same shape the state machine expects: onState/onMessage
// callbacks and connect/send/request/close. It scripts the required scenarios:
// room created, second player joined, both ready, round started, answer
// accepted, round result, and a match win.

const PUZZLE = { numbers: [75, 50, 2, 3, 8, 7], target: 521 };

export function createMockTransport() {
  return ({ onState, onMessage }) => new MockTransport({ onState, onMessage });
}

class MockTransport {
  constructor({ onState, onMessage }) {
    this._onState = onState;
    this._onMessage = onMessage;
    this._me = null;
    this._bot = { playerId: "bot", displayName: "Robo", isHost: false, ready: false, active: true };
    this._scores = { you: 0, bot: 0 };
    this._round = 0;
    this._current = null;
    this._mySub = null;
  }

  connect() {
    setTimeout(() => this._onState("connected"), 120);
  }
  close() {
    this._onState("disconnected");
  }
  request(message) {
    this.send(message);
    return Promise.resolve();
  }
  send(message) {
    setTimeout(() => this._handle(message), 150);
  }

  _emit(type, payload) {
    this._onMessage({ type, requestId: null, payload, error: null });
  }

  _room() {
    return {
      code: "TEST",
      status: this._current ? "PLAYING" : "WAITING",
      capacity: 2,
      bestOf: 5,
      currentRound: this._round,
      hostPlayerId: this._me?.playerId,
      scores: { ...this._scores },
      players: [this._me, this._bot],
    };
  }

  _handle({ action, payload }) {
    switch (action) {
      case "createRoom":
        return this._enterRoom(payload.displayName, true);
      case "joinRoom":
        return this._enterRoom(payload.displayName, false);
      case "ready":
        return this._ready();
      case "submitAnswer":
        return this._submit(payload);
      case "nextRound":
        return this._finalize();
      default:
        return undefined; // ping etc.
    }
  }

  _enterRoom(name, isHost) {
    this._me = { playerId: "you", displayName: name || "You", isHost, ready: false, active: true };
    this._emit(isHost ? "roomCreated" : "roomJoined", {
      playerId: "you",
      match: { bestOf: 5, winsNeeded: 3, capacity: 2, roundSeconds: 45 },
      room: this._room(),
    });
  }

  _ready() {
    this._me.ready = true;
    this._emit("readyUpdated", { room: this._room() });
    // The bot readies up a beat later, which starts the round.
    setTimeout(() => {
      this._bot.ready = true;
      this._emit("readyUpdated", { room: this._room() });
      setTimeout(() => this._start(), 300);
    }, 500);
  }

  _start() {
    this._round += 1;
    this._me.ready = false;
    this._bot.ready = false;
    this._mySub = null;
    const now = Date.now();
    this._current = {
      roomCode: "TEST",
      matchId: "mock",
      roundNumber: this._round,
      numbers: PUZZLE.numbers,
      target: PUZZLE.target,
      startsAt: now + 3000,
      endsAt: now + 3000 + 45000,
      revealAt: now + 3000 + 45000 + 3000,
      status: "ACTIVE",
    };
    this._botSub = {
      playerId: "bot",
      expression: "75 + 50",
      value: 125,
      distance: Math.abs(125 - PUZZLE.target),
      operations: 1,
      exact: false,
      submittedAt: now + 9000,
    };
    this._emit("roundStarted", this._current);
  }

  _submit(payload) {
    const value = Number(payload.claimedResult) || 0;
    this._mySub = {
      playerId: "you",
      expression: payload.expression,
      value,
      distance: Math.abs(value - this._current.target),
      operations: (payload.expression.match(/[+\-*/]/g) || []).length,
      exact: value === this._current.target,
      submittedAt: Date.now(),
    };
    this._emit("answerAccepted", { accepted: true, roundNumber: this._round, best: this._mySub });
    setTimeout(() => this._finalize(), 600);
  }

  _finalize() {
    if (!this._current) return;
    const subs = [this._mySub, this._botSub].filter(Boolean);
    const ranked = subs
      .slice()
      .sort((a, b) => a.distance - b.distance || a.operations - b.operations || a.submittedAt - b.submittedAt);
    const winnerId = ranked.length ? ranked[0].playerId : null;
    if (winnerId) this._scores[winnerId] += 1;
    const matchComplete = Math.max(...Object.values(this._scores)) >= 3;
    const target = this._current.target;
    const numbers = this._current.numbers;
    this._current = null;
    this._emit("roundResult", {
      roomCode: "TEST",
      roundNumber: this._round,
      target,
      numbers,
      status: "COMPLETE",
      winnerId,
      isTie: false,
      submissions: subs,
      scores: { ...this._scores },
      matchComplete,
      matchWinnerId: matchComplete ? winnerId : null,
    });
  }
}
