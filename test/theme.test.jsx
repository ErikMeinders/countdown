import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/sound.js", () => ({
  Sound: new Proxy({}, { get: () => vi.fn().mockResolvedValue(undefined) }),
}));

import App from "../src/App.jsx";
import { ThemeProvider } from "../src/theme-context.jsx";
import { ROUND_LENGTHS } from "../src/game/rules.js";

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("round lengths", () => {
  it("offers 30, 45 and 60 seconds", () => {
    expect(ROUND_LENGTHS).toEqual([30, 45, 60]);
    render(<App />);
    for (const len of [30, 45, 60]) {
      expect(screen.getByText(`${len}s`)).toBeDefined();
    }
  });
});

describe("theme toggle", () => {
  const toggle = () => screen.getByLabelText(/^Theme:/);

  it("cycles auto → light → dark and persists the choice", () => {
    render(<ThemeProvider><App /></ThemeProvider>);

    // Default is auto until the user picks.
    expect(toggle().getAttribute("aria-label")).toMatch(/auto/);

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-label")).toMatch(/light/);
    expect(localStorage.getItem("countdown-theme")).toBe("light");

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-label")).toMatch(/dark/);

    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-label")).toMatch(/auto/);
  });

  it("restores a saved choice on load", () => {
    localStorage.setItem("countdown-theme", "light");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(toggle().getAttribute("aria-label")).toMatch(/light/);
  });

  it("reflects the theme on the document", () => {
    localStorage.setItem("countdown-theme", "dark");
    render(<ThemeProvider><App /></ThemeProvider>);
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
