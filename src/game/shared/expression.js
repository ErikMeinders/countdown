// ── Expression serialization ───────────────────────────────────
// Turns the calculator's step tree into a single infix expression string the
// backend can validate, and finds the player's best answer to submit. The
// backend recomputes and re-validates everything; this only produces a faithful
// string and a local *preview* of value/distance.

import { OPERATORS } from "../rules.js";

// The board renders operators as −, ×, ÷; the backend accepts those, but plain
// ASCII travels more predictably on the wire.
const ASCII_OP = { "+": "+", "−": "-", "×": "*", "÷": "/" };
export function toAsciiOp(op) {
  return ASCII_OP[op] || op;
}

// Recursively build the infix expression for one intermediate, with its
// operation count. Child intermediates are parenthesised; bare numbers are not.
function buildForIntermediate(state, index) {
  const step = state.steps[index];
  const node = state.intermediates[index];
  if (!step || !node) return { expr: "", ops: 0 };

  const operand = (src) => {
    if (src.type === "number") return { expr: String(state.numbers[src.index]), ops: 0 };
    const child = buildForIntermediate(state, src.index);
    return { expr: `(${child.expr})`, ops: child.ops };
  };

  const [aSrc, bSrc] = node.sources;
  const a = operand(aSrc);
  const b = operand(bSrc);
  return { expr: `${a.expr} ${toAsciiOp(step.op)} ${b.expr}`, ops: a.ops + b.ops + 1 };
}

export function expressionForIntermediate(state, index) {
  return buildForIntermediate(state, index).expr;
}

// The player's best available answer: the value (intermediate or an untouched
// number) closest to the target, with the expression and operation count to
// submit. Returns null if the board is somehow empty.
export function bestAnswer(state) {
  const { target } = state;
  let best = null;

  const consider = (value, distance, expr, ops) => {
    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && ops < best.operations)
    ) {
      best = { value, distance, expression: expr, operations: ops, exact: distance === 0 };
    }
  };

  state.intermediates.forEach((im, i) => {
    if (!im || state.usedIntermediates.has(i)) return;
    const { expr, ops } = buildForIntermediate(state, i);
    consider(im.value, Math.abs(im.value - target), expr, ops);
  });
  state.numbers.forEach((n, i) => {
    if (state.usedIndices.has(i)) return;
    consider(n, Math.abs(n - target), String(n), 0);
  });

  return best;
}

// A count of operators in an expression string — used to validate the operator
// set locally for immediate feedback. Kept simple and permissive; the backend
// is authoritative.
export function operatorsIn(expr) {
  return (String(expr).match(/[+\-*/]/g) || []).length;
}

export { OPERATORS };
