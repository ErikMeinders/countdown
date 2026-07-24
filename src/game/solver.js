import { OPERATORS, evaluate } from "./rules.js";

// ── Solver ─────────────────────────────────────────────────────
export function solve(numbers, target) {
  let bestDiff = Infinity;
  let bestSteps = [];

  function search(available, steps) {
    for (const val of available) {
      const diff = Math.abs(val - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSteps = [...steps];
        if (diff === 0) return;
      }
    }
    if (bestDiff === 0) return;

    for (let i = 0; i < available.length; i++) {
      for (let j = 0; j < available.length; j++) {
        if (i === j) continue;
        const a = available[i], b = available[j];
        const rest = available.filter((_, k) => k !== i && k !== j);
        for (const op of OPERATORS) {
          const result = evaluate(a, op, b);
          if (result === null || result <= 0 || !Number.isInteger(result)) continue;
          search([...rest, result], [...steps, { a, op, b, result }]);
          if (bestDiff === 0) return;
        }
      }
    }
  }

  search(numbers, []);
  return { diff: bestDiff, steps: bestSteps, exact: bestDiff === 0 };
}
