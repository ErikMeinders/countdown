import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  REEL_CELLS, REEL_EASE, REEL_TRAVEL,
  reelCrossings, reelDelay, reelDuration, reelLanding,
} from "../src/reels.js";

const css = readFileSync("src/styles/animations.css", "utf8");

// The rattle is timed against the curve the animation actually follows. If
// the keyframes and reels.js disagree, the clicks drift off the numerals and
// nothing else in the suite would notice.
describe("the animation and the motion model agree", () => {
  it("hands over to the settle at REEL_TRAVEL", () => {
    const travel = `${REEL_TRAVEL * 100}%`;
    expect(css).toContain(`${travel}  { transform: translateY(var(--reel-end)) }`);
  });

  it("settles without moving past another whole cell", () => {
    const rocks = [...css.matchAll(/--reel-end\)\s*[-+]\s*(\d+)px/g)]
      .map((m) => Number(m[1]));
    expect(rocks.length).toBeGreaterThan(0);
    for (const px of rocks) expect(px).toBeLessThan(58 / 2);
  });
});

describe("reelCrossings", () => {
  it.each([0, 1, 2])("covers reel %i from start to landing", (i) => {
    const times = reelCrossings(i);
    expect(times.length).toBeGreaterThan(20);
    expect(times[0]).toBeGreaterThanOrEqual(reelDelay(i) / 1000);
    expect(times.at(-1)).toBeLessThanOrEqual(reelLanding(i) + 1e-9);
  });

  it("is strictly increasing, so Tone will accept the schedule", () => {
    for (const i of [0, 1, 2]) {
      const times = reelCrossings(i);
      for (let k = 1; k < times.length; k++) {
        expect(times[k]).toBeGreaterThan(times[k - 1]);
      }
    }
  });

  // The point of the whole exercise: the clicks slow down because the reel
  // does, not because a gap is being multiplied by a constant.
  //
  // The strip starts from rest, so it winds up before it runs down and the
  // gaps narrow before they widen.
  it("winds up, then decelerates all the way to the stop", () => {
    const times = reelCrossings(0);
    const gaps = times.slice(1).map((t, k) => t - times[k]);
    const fastest = gaps.indexOf(Math.min(...gaps));

    // Past the turning point the gaps only ever widen. Nothing is dropped,
    // so this holds exactly rather than within a tolerance.
    for (let k = fastest + 1; k < gaps.length; k++) {
      expect(gaps[k]).toBeGreaterThan(gaps[k - 1]);
    }
    expect(gaps.at(-1)).toBeGreaterThan(gaps[fastest] * 10);
  });

  it("clicks once per numeral, with none dropped", () => {
    expect(reelCrossings(0)).toHaveLength(REEL_CELLS);
  });
});

describe("reel timing", () => {
  it("staggers the reels so they land left to right", () => {
    expect(reelLanding(0)).toBeLessThan(reelLanding(1));
    expect(reelLanding(1)).toBeLessThan(reelLanding(2));
  });

  it("uses the same easing the stylesheet does", () => {
    expect(REEL_EASE).toHaveLength(4);
    expect(reelDuration(2)).toBeGreaterThan(reelDuration(0));
  });
});
