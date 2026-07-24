export const PHASES = { PICK: "pick", PLAY: "play", RESULT: "result" };
export const PHASE_ORDER = { pick: 0, play: 1, result: 2 };

export const REDUCED = typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const SWAP_MS = REDUCED ? 0 : 260;
