import { afterEach, describe, expect, it, vi } from "vitest";

import { WebSocketClient } from "../../src/services/websocketClient.js";

// A minimal fake socket we drive by hand.
class FakeSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sent = [];
    FakeSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  _open() {
    this.readyState = 1;
    this.onopen?.();
  }
  _message(obj) {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}
FakeSocket.instances = [];

function makeClient(overrides = {}) {
  const states = [];
  const messagesIn = [];
  const client = new WebSocketClient("wss://example/dev", {
    onState: (s) => states.push(s),
    onMessage: (m) => messagesIn.push(m),
    socketFactory: (u) => new FakeSocket(u),
    ...overrides,
  });
  return { client, states, messagesIn };
}

afterEach(() => {
  FakeSocket.instances = [];
  vi.useRealTimers();
});

describe("WebSocketClient", () => {
  it("queues sends until open, then flushes them", () => {
    const { client } = makeClient();
    client.connect();
    const socket = FakeSocket.instances[0];
    client.send({ action: "ping", requestId: "r1", payload: {} });
    expect(socket.sent).toHaveLength(0);
    socket._open();
    expect(socket.sent).toHaveLength(1);
  });

  it("correlates a response to its request by requestId", async () => {
    const { client } = makeClient();
    client.connect();
    const socket = FakeSocket.instances[0];
    socket._open();
    const promise = client.request({ action: "createRoom", requestId: "rid", payload: {} });
    socket._message({ type: "roomCreated", requestId: "rid", payload: { ok: true } });
    await expect(promise).resolves.toMatchObject({ type: "roomCreated" });
  });

  it("forwards every message and handles duplicates without throwing", () => {
    const { client, messagesIn } = makeClient();
    client.connect();
    const socket = FakeSocket.instances[0];
    socket._open();
    socket._message({ type: "roundStarted", payload: {} });
    socket._message({ type: "roundStarted", payload: {} });
    expect(messagesIn.filter((m) => m.type === "roundStarted")).toHaveLength(2);
  });

  it("drops malformed frames silently", () => {
    const { client, messagesIn } = makeClient();
    client.connect();
    const socket = FakeSocket.instances[0];
    socket._open();
    socket.onmessage({ data: "not json" });
    expect(messagesIn).toHaveLength(0);
  });

  it("reconnects with backoff after an unexpected close", () => {
    vi.useFakeTimers();
    const { client, states } = makeClient();
    client.connect();
    FakeSocket.instances[0]._open();
    FakeSocket.instances[0].onclose(); // unexpected drop
    expect(states).toContain("reconnecting");
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.instances.length).toBe(2); // a new socket was created
  });

  it("stops reconnecting after an explicit close", () => {
    vi.useFakeTimers();
    const { client, states } = makeClient();
    client.connect();
    FakeSocket.instances[0]._open();
    client.close();
    expect(states).toContain("disconnected");
    vi.advanceTimersByTime(30000);
    expect(FakeSocket.instances.length).toBe(1); // no reconnect attempted
  });
});
