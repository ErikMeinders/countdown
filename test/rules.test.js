import { describe, expect, it } from "vitest";

import {
  LARGE_NUMBERS,
  evaluate,
  generateNumbers,
  generateSolvableTarget,
  generateTarget,
} from "../src/game/rules.js";
import { solve } from "../src/game/solver.js";

describe("evaluate", () => {
  it("does the four operations", () => {
    expect(evaluate(7, "+", 3)).toBe(10);
    expect(evaluate(7, "−", 3)).toBe(4);
    expect(evaluate(7, "×", 3)).toBe(21);
    expect(evaluate(6, "÷", 3)).toBe(2);
  });

  // The two rules that make it Countdown rather than arithmetic.
  it("rejects division that isn't exact", () => {
    expect(evaluate(7, "÷", 2)).toBeNull();
    expect(evaluate(7, "÷", 0)).toBeNull();
  });

  it("returns a negative for subtraction, which callers must reject", () => {
    expect(evaluate(3, "−", 7)).toBe(-4);
  });

  it("rejects an unknown operator", () => {
    expect(evaluate(3, "*", 7)).toBeNull();
  });
});

describe("generateNumbers", () => {
  it.each([0, 1, 2, 3, 4])("draws six tiles with %i large", (numLarge) => {
    const n = generateNumbers(numLarge);
    expect(n).toHaveLength(6);
    expect(n.filter((v) => LARGE_NUMBERS.includes(v))).toHaveLength(numLarge);
    expect(n.filter((v) => v >= 1 && v <= 10)).toHaveLength(6 - numLarge);
  });

  it("never repeats a large number", () => {
    for (let i = 0; i < 50; i++) {
      const large = generateNumbers(4).filter((v) => LARGE_NUMBERS.includes(v));
      expect(new Set(large).size).toBe(4);
    }
  });

  it("uses each small number at most twice", () => {
    for (let i = 0; i < 50; i++) {
      const counts = {};
      for (const v of generateNumbers(0)) counts[v] = (counts[v] || 0) + 1;
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
    }
  });
});

describe("targets", () => {
  it("generateTarget stays in the three-digit range", () => {
    for (let i = 0; i < 200; i++) {
      const t = generateTarget();
      expect(t).toBeGreaterThanOrEqual(101);
      expect(t).toBeLessThanOrEqual(999);
    }
  });

  // The whole promise of the "Solvable" mode: an exact answer always exists.
  it("generateSolvableTarget produces a target the solver can hit exactly", () => {
    for (let i = 0; i < 15; i++) {
      const numbers = generateNumbers(i % 5);
      const target = generateSolvableTarget(numbers);
      expect(target).toBeGreaterThanOrEqual(101);
      expect(target).toBeLessThanOrEqual(999);
      expect(solve(numbers, target).exact).toBe(true);
    }
  });
});
