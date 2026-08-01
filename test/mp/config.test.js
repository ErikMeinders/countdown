import { afterEach, describe, expect, it, vi } from "vitest";

import { getWebSocketUrl, isMultiplayerConfigured } from "../../src/services/config.js";

afterEach(() => vi.unstubAllEnvs());

describe("multiplayer config", () => {
  it("is unconfigured when the URL is missing", () => {
    vi.stubEnv("VITE_COUNTDOWN_WEBSOCKET_URL", "");
    expect(getWebSocketUrl()).toBeNull();
    expect(isMultiplayerConfigured()).toBe(false);
  });

  it("reads a configured URL", () => {
    vi.stubEnv("VITE_COUNTDOWN_WEBSOCKET_URL", "wss://abc.execute-api.eu-west-1.amazonaws.com/dev");
    expect(getWebSocketUrl()).toBe("wss://abc.execute-api.eu-west-1.amazonaws.com/dev");
    expect(isMultiplayerConfigured()).toBe(true);
  });
});
