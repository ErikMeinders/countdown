export const PHASES = { PICK: "pick", PLAY: "play", RESULT: "result" };
export const PHASE_ORDER = { pick: 0, play: 1, result: 2 };

export const REDUCED = typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const SWAP_MS = REDUCED ? 0 : 260;

// The six tiles are dealt one at a time before the reels start, so the reels
// wait for them. Shared by the deal timers and the reel animation delays.
export const TILE_DEAL_MS = 700;
export const REEL_START_MS = 3500;
