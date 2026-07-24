import { OPERATORS, evaluate } from "./rules.js";

// ── Solver ─────────────────────────────────────────────────────
// Returns the shortest line it can find to the target, or the closest miss.
//
// Each candidate value carries the steps that produced it, rather than the
// search carrying one running list. With a shared list the reported answer
// included every operation performed along the way, including the ones that
// fed values the answer never used.
export function solve(numbers, target) {
  // No operation at all beats any operation. Checked before the pair scan
  // below, which would otherwise answer a target of 100 with 25 + 75 while
  // a 100 tile sat on the board.
  if (numbers.includes(target)) return { diff: 0, steps: [], exact: true };

  // A single operation on two tiles is the tidiest possible answer, and the
  // search below would rather find some six-tile chain first. Cheap to check
  // up front: at most 4 × 6 × 5 combinations.
  for (let i = 0; i < numbers.length; i++) {
    for (let j = 0; j < numbers.length; j++) {
      if (i === j) continue;
      for (const op of OPERATORS) {
        const result = evaluate(numbers[i], op, numbers[j]);
        if (result === target) {
          return {
            diff: 0,
            steps: [{ a: numbers[i], op, b: numbers[j], result }],
            exact: true,
          };
        }
      }
    }
  }

  let bestDiff = Infinity;
  let bestSteps = [];

  function search(available) {
    for (const candidate of available) {
      const diff = Math.abs(candidate.value - target);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestSteps = [...candidate.steps];
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
          const result = evaluate(a.value, op, b.value);
          if (result === null || result <= 0 || !Number.isInteger(result)) continue;
          search([...rest, {
            value: result,
            steps: [...a.steps, ...b.steps, { a: a.value, op, b: b.value, result }],
          }]);
          if (bestDiff === 0) return;
        }
      }
    }
  }

  search(numbers.map((value) => ({ value, steps: [] })));
  return { diff: bestDiff, steps: bestSteps, exact: bestDiff === 0 };
}
