// ── Reel motion ────────────────────────────────────────────────
// The rattle has to be the strip crossing cells, not a rhythm that merely
// resembles one — so the sound and the animation are both derived from the
// numbers here rather than each keeping its own copy. animations.css holds
// the keyframes; reels.test.js checks the two still agree.

export const REEL_CELL = 58;
export const REEL_WIDTH = 36;
export const REEL_LOOPS = 5;

// Cells the strip travels past: ten numerals per loop, plus the one it rests
// on. Each of these crossing the window is one click.
export const REEL_CELLS = REEL_LOOPS * 10 + 1;

export const REEL_STAGGER_MS = 220;   // reel 2 starts this far behind reel 1
export const REEL_BASE_MS = 1700;
export const REEL_STEP_MS = 260;      // each reel runs longer than the last

// The share of the animation spent travelling. The remainder is the settle:
// a small overshoot and rock, which no longer moves past whole cells.
export const REEL_TRAVEL = 0.84;
export const REEL_EASE = [0.15, 0.66, 0.18, 1];

export const reelDelay = (i) => i * REEL_STAGGER_MS;
export const reelDuration = (i) => REEL_BASE_MS + i * REEL_STEP_MS;

// A CSS cubic-bezier maps time to progress through two control points. We
// have the progress — the fraction of cells passed — and need the time, so
// solve for the curve parameter and read the time coordinate off it.
function timeAtProgress([x1, y1, x2, y2], progress) {
  const axis = (a, b, t) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };

  let lo = 0, hi = 1;
  for (let n = 0; n < 40; n++) {         // ~1e-12, far tighter than a frame
    const mid = (lo + hi) / 2;
    if (axis(y1, y2, mid) < progress) lo = mid;
    else hi = mid;
  }
  return axis(x1, x2, (lo + hi) / 2);
}

// When each cell boundary passes the window for reel `i`, in seconds from the
// moment the reels are set going. Every numeral gets one — at full speed they
// are a few milliseconds apart and fuse into a buzz, which is what a reel
// going flat out sounds like, and they separate into a rattle as it slows.
//
// Dropping the fast ones was tried and is worse: the gap between the clicks
// that survive is a multiple of the cell spacing, so when the multiple falls
// from 3 to 2 the rattle audibly speeds up in the middle of slowing down.
export function reelCrossings(i) {
  const delay = reelDelay(i) / 1000;
  const duration = reelDuration(i) / 1000;
  const times = [];

  for (let cell = 1; cell <= REEL_CELLS; cell++) {
    const t = timeAtProgress(REEL_EASE, cell / REEL_CELLS);
    times.push(delay + t * REEL_TRAVEL * duration);
  }
  return times;
}

// When reel `i` comes to rest.
export const reelLanding = (i) => (reelDelay(i) + reelDuration(i) * REEL_TRAVEL) / 1000;
