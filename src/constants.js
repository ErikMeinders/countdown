export const PHASES = { PICK: "pick", PLAY: "play", RESULT: "result" };
export const PHASE_ORDER = { pick: 0, play: 1, result: 2 };

export const REDUCED = typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
export const SWAP_MS = REDUCED ? 0 : 260;

// The six tiles are dealt one at a time, then the reels spin.
//
// One constant drives both the click timers and the pop-in delays: with the
// two set separately the tiles all appeared at once and the six clicks
// rattled off afterwards, with nothing to attach them to.
export const TILE_DEAL_MS = 700;
export const TILE_COUNT = 6;

// The reels take over as the last tile lands.
export const REEL_START_MS = (TILE_COUNT - 1) * TILE_DEAL_MS;
