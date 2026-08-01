import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Tone needs a real AudioContext. The game treats sound as decoration, so the
// whole engine is stubbed out and the UI is exercised on its own.
vi.mock("../src/sound.js", () => ({
  Sound: new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) }),
}));

import App from "../src/App.jsx";
import { TILE_COUNT, TILE_DEAL_MS } from "../src/constants.js";

afterEach(cleanup);

describe("the game", () => {
  it("opens on the pick screen", () => {
    render(<App />);
    expect(screen.getByText("COUNTDOWN")).toBeDefined();
    expect(screen.getByText("Large numbers")).toBeDefined();
    expect(screen.getByText("Round length")).toBeDefined();
    expect(screen.getByText("45s")).toBeDefined();
    expect(screen.getByText("Single")).toBeDefined();
  });

  it("deals six tiles and a target when a round starts", async () => {
    render(<App />);
    fireEvent.click(screen.getByText("Single"));

    // The clock is held back until the reels settle, so the prompt is what
    // tells us the play screen is live.
    const prompt = await waitFor(() => screen.getByText(/Tap a number,/));
    expect(prompt).toBeDefined();
    expect(screen.getByText("Target")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
  });

  // The tiles' pop-in and their clicks are scheduled in different places. When
  // they drifted apart the six tiles appeared at once and the clicks rattled
  // off afterwards with nothing to attach to.
  it("staggers the tile pop-in by the same interval as the deal clicks", async () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByText("Single"));
    await waitFor(() => screen.getByText(/Tap a number,/));

    // jsdom doesn't expand the `animation` shorthand, so read the attribute.
    const dealt = [...container.querySelectorAll("div")]
      .map((el) => el.getAttribute("style") || "")
      .filter((s) => s.includes("animation: popIn") && s.includes("animation-delay"))
      .map((s) => parseInt(s.match(/animation-delay:\s*(\d+)ms/)[1], 10));

    expect(dealt).toHaveLength(TILE_COUNT);
    expect(dealt).toEqual(
      Array.from({ length: TILE_COUNT }, (_, i) => i * TILE_DEAL_MS)
    );
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
    fireEvent.click(screen.getByText("Single"));
    await waitFor(() => screen.getByText("Submit"));

    fireEvent.click(screen.getByText("Submit"));
    expect(await screen.findByText("Next round")).toBeDefined();
    expect(screen.getByText("Target")).toBeDefined(); // shared puzzle panel
    expect(screen.getByText(/pts total/)).toBeDefined(); // session points tracker
  });
});
