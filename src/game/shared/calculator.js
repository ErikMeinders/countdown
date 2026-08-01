// ── Shared calculator ──────────────────────────────────────────
// A pure, framework-free port of the local game's tap-to-build interaction:
// pick a number, pick an operator, pick a second number → an intermediate tile.
// It enforces the Countdown rules (positive whole numbers, exact division) the
// same way the local board does.
//
// This is used by the *multiplayer* board only. The local single-player game
// keeps its own copy of this logic inline in App.jsx, so nothing here can
// affect it — the price is a little duplication, paid to keep local mode safe.

import { evaluate } from "../rules.js";

export function initCalculator(numbers, target) {
  return {
    numbers,
    target,
    usedIndices: new Set(),
    usedIntermediates: new Set(),
    steps: [],
    intermediates: [],
    currentA: null,
    currentOp: null,
  };
}

// The most recent calculated tile still on the board — an operator tap with
// nothing selected chains from it.
export function lastCalcIndex(s) {
  for (let i = s.intermediates.length - 1; i >= 0; i--) {
    if (s.intermediates[i] && !s.usedIntermediates.has(i)) return i;
  }
  return -1;
}

export function clearSelection(s) {
  return { ...s, currentA: null, currentOp: null };
}

export function selectNumber(s, value, sourceType, sourceIndex) {
  if (s.currentA === null) {
    return { ...s, currentA: { value, sourceType, sourceIndex } };
  }
  // Tapping the selected tile again deselects it.
  if (s.currentA.sourceType === sourceType && s.currentA.sourceIndex === sourceIndex) {
    return clearSelection(s);
  }
  if (!s.currentOp) {
    return { ...s, currentA: { value, sourceType, sourceIndex } };
  }

  const result = evaluate(s.currentA.value, s.currentOp, value);
  if (result === null || result <= 0 || !Number.isInteger(result)) {
    return clearSelection(s);
  }

  const usedIndices = new Set(s.usedIndices);
  if (s.currentA.sourceType === "number") usedIndices.add(s.currentA.sourceIndex);
  if (sourceType === "number") usedIndices.add(sourceIndex);

  const usedIntermediates = new Set(s.usedIntermediates);
  if (s.currentA.sourceType === "intermediate") usedIntermediates.add(s.currentA.sourceIndex);
  if (sourceType === "intermediate") usedIntermediates.add(sourceIndex);

  const sources = [
    { type: s.currentA.sourceType, index: s.currentA.sourceIndex },
    { type: sourceType, index: sourceIndex },
  ];
  return {
    ...s,
    usedIndices,
    usedIntermediates,
    steps: [...s.steps, { a: s.currentA.value, op: s.currentOp, b: value, result }],
    intermediates: [...s.intermediates, { value: result, sources }],
    currentA: null,
    currentOp: null,
  };
}

export function selectOperator(s, op) {
  if (s.currentA !== null) {
    return { ...s, currentOp: op };
  }
  const idx = lastCalcIndex(s);
  if (idx >= 0) {
    return {
      ...s,
      currentA: {
        value: s.intermediates[idx].value,
        sourceType: "intermediate",
        sourceIndex: idx,
        implied: true,
      },
      currentOp: op,
    };
  }
  return s;
}

export function undoIntermediate(s, index) {
  const im = s.intermediates[index];
  if (!im || s.usedIntermediates.has(index)) return s;

  const usedIndices = new Set(s.usedIndices);
  const usedIntermediates = new Set(s.usedIntermediates);
  for (const src of im.sources) {
    if (src.type === "number") usedIndices.delete(src.index);
    if (src.type === "intermediate") usedIntermediates.delete(src.index);
  }
  const intermediates = [...s.intermediates];
  intermediates[index] = null;
  const steps = [...s.steps];
  steps[index] = null;

  let next = { ...s, usedIndices, usedIntermediates, intermediates, steps };
  if (s.currentA?.sourceType === "intermediate" && s.currentA?.sourceIndex === index) {
    next = clearSelection(next);
  }
  return next;
}

export function resetWorking(s) {
  return initCalculator(s.numbers, s.target);
}
