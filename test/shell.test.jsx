import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The local game pulls in Tone via sound.js; stub it as the local tests do.
vi.mock("../src/sound.js", () => ({
  Sound: new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) }),
}));

import Shell from "../src/Shell.jsx";
import { ThemeProvider } from "../src/theme-context.jsx";

const renderShell = () =>
  render(
    <ThemeProvider>
      <Shell />
    </ThemeProvider>
  );

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  delete globalThis.WebSocket;
});

describe("shell opens in single-player", () => {
  beforeEach(() => vi.stubEnv("VITE_COUNTDOWN_WEBSOCKET_URL", ""));

  it("opens directly on the parameters screen — no splash", () => {
    renderShell();
    expect(screen.getByText("Large numbers")).toBeDefined();
    expect(screen.getByText("Single")).toBeDefined();
    expect(screen.getByText("Together")).toBeDefined();
  });

  it("disables Together when no backend URL is set", () => {
    renderShell();
    expect(screen.getByText("Together").closest("button").disabled).toBe(true);
    expect(screen.getByText(/local play only/i)).toBeDefined();
  });

  it("Single starts the local game without a WebSocket", async () => {
    const ws = vi.fn();
    globalThis.WebSocket = ws;
    renderShell();
    fireEvent.click(screen.getByText("Single"));
    await waitFor(() => screen.getByText("Submit"));
    expect(ws).not.toHaveBeenCalled();
  });
});

describe("shell can enter multiplayer", () => {
  it("Together opens the multiplayer landing when configured (no socket yet)", () => {
    vi.stubEnv("VITE_COUNTDOWN_WEBSOCKET_URL", "wss://abc.execute-api.eu-west-1.amazonaws.com/dev");
    const ws = vi.fn();
    globalThis.WebSocket = ws;
    renderShell();
    fireEvent.click(screen.getByText("Together"));
    expect(screen.getByText("Create room")).toBeDefined();
    expect(screen.getByText("Join room")).toBeDefined();
    expect(ws).not.toHaveBeenCalled();
  });
});
