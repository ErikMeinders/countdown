// ── Game Constants ─────────────────────────────────────────────
export const LARGE_NUMBERS = [25, 50, 75, 100];
export const SMALL_NUMBERS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10];
export const OPERATORS = ["+", "−", "×", "÷"];
export const ROUND_LENGTHS = [30, 60];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function generateNumbers(numLarge) {
  return shuffle([
    ...shuffle(LARGE_NUMBERS).slice(0, numLarge),
    ...shuffle(SMALL_NUMBERS).slice(0, 6 - numLarge),
  ]);
}

// Authentic: a bare random three-digit number, which may well be unreachable.
export function generateTarget() {
  return Math.floor(Math.random() * 899) + 101;
}

// Guaranteed reachable: fold the tiles together with random valid operations
// and harvest whatever lands in range. Anything produced this way is, by
// construction, something the player can rebuild.
export function generateSolvableTarget(numbers) {
  const candidates = [];

  for (let attempt = 0; attempt < 60; attempt++) {
    let pool = shuffle(numbers);
    while (pool.length > 1) {
      const [a, b] = pool;
      let result = null;
      for (const op of shuffle(OPERATORS)) {
        const r = evaluate(a, op, b);
        if (r !== null && r > 0 && Number.isInteger(r)) { result = r; break; }
      }
      if (result === null) break;
      if (result >= 101 && result <= 999) candidates.push(result);
      pool = shuffle([result, ...pool.slice(2)]);
    }
  }

  if (!candidates.length) return generateTarget();
  return candidates[Math.floor(Math.random() * candidates.length)];
}
export function evaluate(a, op, b) {
  switch (op) {
    case "+": return a + b;
    case "−": return a - b;
    case "×": return a * b;
    case "÷": return b !== 0 && a % b === 0 ? a / b : null;
    default: return null;
  }
}
