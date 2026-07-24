import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Tone needs a real AudioContext. The game treats sound as decoration, so the
// whole engine is stubbed out and the UI is exercised on its own.
vi.mock("../src/sound.js", () => ({
  Sound: new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) }),
}));

import App from "../src/App.jsx";

afterEach(cleanup);

describe("the game", () => {
  it("opens on the pick screen", () => {
    render(<App />);
    expect(screen.getByText("COUNTDOWN")).toBeDefined();
    expect(screen.getByText("How many large numbers?")).toBeDefined();
    expect(screen.getByText("30")).toBeDefined();
    expect(screen.getByText("60")).toBeDefined();
  });

  it("deals six tiles and a target when a round starts", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("30"));

    // The clock is held back until the reels settle, so the prompt is what
    // tells us the play screen is live.
    const prompt = await waitFor(() => screen.getByText(/Tap a number,/));
    expect(prompt).toBeDefined();
    expect(screen.getByText("Target")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
  });

  it("opens and closes the help overlay", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("How to play"));
    expect(await screen.findByText("HOW TO PLAY")).toBeDefined();

    fireEvent.click(screen.getByText("Got it"));
    await waitFor(() => expect(screen.queryByText("HOW TO PLAY")).toBeNull());
  });

  it("scores a round that is submitted untouched", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("30"));
    await waitFor(() => screen.getByText("Submit"));

    fireEvent.click(screen.getByText("Submit"));
    expect(await screen.findByText("New Round")).toBeDefined();
    expect(screen.getByText("Given numbers", { exact: false })).toBeDefined();
    expect(screen.getByText(/point/)).toBeDefined();
  });
});
