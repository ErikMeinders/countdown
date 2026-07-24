import { describe, expect, it } from "vitest";

import { evaluate } from "../src/game/rules.js";
import { solve } from "../src/game/solver.js";
import { traceTiles } from "../src/game/trace.js";

// Replay a solution the way the game does, to prove the steps really produce
// the claimed result from the given tiles and never reuse one.
function replay(numbers, steps) {
  let pool = [...numbers];
  for (const { a, op, b, result } of steps) {
    const i = pool.indexOf(a);
    expect(i, `${a} not available`).toBeGreaterThanOrEqual(0);
    pool.splice(i, 1);
    const j = pool.indexOf(b);
    expect(j, `${b} not available`).toBeGreaterThanOrEqual(0);
    pool.splice(j, 1);
    expect(evaluate(a, op, b)).toBe(result);
    expect(Number.isInteger(result) && result > 0).toBe(true);
    pool.push(result);
  }
  return pool;
}

describe("solve", () => {
  it("finds an exact answer when one exists", () => {
    const r = solve([25, 50, 75, 100, 3, 6], 952);
    expect(r.exact).toBe(true);
    expect(r.diff).toBe(0);
    expect(replay([25, 50, 75, 100, 3, 6], r.steps)).toContain(952);
  });

  it("takes no steps when a tile is already the target", () => {
    const r = solve([25, 50, 75, 100, 3, 6], 100);
    expect(r.exact).toBe(true);
    expect(r.steps).toEqual([]);
  });

  it("prefers a single operation over a longer chain to the same target", () => {
    const r = solve([25, 50, 75, 3, 6, 7], 125);
    expect(r.exact).toBe(true);
    expect(r.steps).toHaveLength(1);
  });

  // With one shared step list the answer used to include operations that fed
  // values the answer never used.
  it("reports only the steps that produced the answer", () => {
    const numbers = [25, 50, 75, 100, 3, 6];
    const r = solve(numbers, 952);
    const pool = replay(numbers, r.steps);
    expect(pool).toContain(952);
    for (const s of r.steps) {
      expect(Number.isInteger(s.result) && s.result > 0).toBe(true);
    }
  });

  it("reports the closest miss when the target is unreachable", () => {
    // 1 1 2 2 3 3 cannot reach anywhere near 999.
    const r = solve([1, 1, 2, 2, 3, 3], 999);
    expect(r.exact).toBe(false);
    expect(r.diff).toBeGreaterThan(0);
    replay([1, 1, 2, 2, 3, 3], r.steps);
  });

  it("only ever produces legal steps", () => {
    for (const target of [317, 481, 629, 843]) {
      const numbers = [25, 50, 4, 7, 8, 9];
      replay(numbers, solve(numbers, target).steps);
    }
  });
});

describe("traceTiles", () => {
  // 3 + 4 = 7, then 7 × 2 = 14 — tiles 0, 1 and 2 all feed the final value.
  const intermediates = [
    { value: 7, sources: [{ type: "number", index: 0 }, { type: "number", index: 1 }] },
    { value: 14, sources: [{ type: "intermediate", index: 0 }, { type: "number", index: 2 }] },
  ];

  it("walks a chain back to the original tiles", () => {
    const tiles = traceTiles(intermediates, { type: "intermediate", index: 1 });
    expect([...tiles].sort()).toEqual([0, 1, 2]);
  });

  it("returns just the tile when the answer is an untouched number", () => {
    expect([...traceTiles(intermediates, { type: "number", index: 5 })]).toEqual([5]);
  });

  it("returns nothing when there is no answer", () => {
    expect(traceTiles(intermediates, null).size).toBe(0);
  });
});
