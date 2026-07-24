import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../theme.js";
import { REEL_START_MS } from "../constants.js";
import {
  REEL_CELL, REEL_EASE, REEL_LOOPS, REEL_WIDTH,
  reelDelay, reelDuration,
} from "../reels.js";

const EASE = `cubic-bezier(${REEL_EASE.join(",")})`;

// ── Slot reels ─────────────────────────────────────────────────
// Each digit is a tall strip of numerals inside a fixed window. The strip
// starts at the top and animates to the cell holding the final digit, so the
// numerals blur past and decelerate into place. Reels are staggered and land
// left to right, the way a fruit machine settles. The motion itself lives in
// reels.js, because the rattle has to follow exactly the same curve.

// The window each digit sits in. Dark and recessed, so the numerals read as
// lit faces behind glass rather than text floating on the panel. Exported so
// the mute control can wear the same face.
export const reelFaceStyle = {
  background: "rgba(0,2,7,0.96)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: 3,
  boxShadow: "inset 0 0 18px rgba(0,0,0,0.8)",
  boxSizing: "border-box",
};

// The lip fade that sells the "behind glass" look, over whatever the window
// holds.
export const REEL_FADE = `linear-gradient(180deg,
  rgba(10,13,22,0.95) 0%, rgba(10,13,22,0) 26%,
  rgba(10,13,22,0) 74%, rgba(10,13,22,0.95) 100%)`;

// Shared by the spinning reel and the settled number, so the faces don't
// change appearance the moment the reels stop.
function ReelFace({ children }) {
  return (
    <div style={{
      ...reelFaceStyle,
      position: "relative", overflow: "hidden",
      height: REEL_CELL, width: REEL_WIDTH,
    }}>
      {children}
      {/* Fades the numerals out at the lip of the window. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: REEL_FADE,
      }} />
    </div>
  );
}

function SlotDigit({ digit, delay, duration, onStop }) {
  const cells = useMemo(() => {
    const a = [];
    for (let l = 0; l < REEL_LOOPS; l++) for (let d = 0; d < 10; d++) a.push(d);
    a.push(digit);                       // the cell it comes to rest on
    return a;
  }, [digit]);

  const finalIdx = cells.length - 1;
  const [go, setGo] = useState(false);
  const [spinning, setSpinning] = useState(true);

  useEffect(() => {
    // Two frames so the browser commits the start position before the
    // animation is applied, otherwise it snaps straight to the end.
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setGo(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);

  return (
    <ReelFace>
      <div
        onAnimationEnd={(e) => {
          if (e.animationName !== "reelSettle") return;
          setSpinning(false);
          onStop?.();
        }}
        style={{
          // reelSettle overshoots and rocks back; a plain transition could
          // only ease to a stop.
          "--reel-end": `${-finalIdx * REEL_CELL}px`,
          animation: go
            ? `reelSettle ${duration}ms ${EASE} ${delay}ms both`
            : "none",
          filter: spinning ? "blur(0.5px)" : "none",
          willChange: "transform",
        }}
      >
        {cells.map((d, i) => (
          <div key={i} style={{
            height: REEL_CELL, lineHeight: `${REEL_CELL}px`,
            textAlign: "center",
          }}>{d}</div>
        ))}
      </div>
    </ReelFace>
  );
}

export function SlotNumber({ value, onSettle }) {
  const digits = String(value).padStart(3, "0").split("").map(Number);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onSettle?.();
  };

  // Safety net: if an animationend is ever missed (backgrounded tab, reduced
  // motion overriding the animation) the clock still starts.
  useEffect(() => {
    const id = setTimeout(finish, REEL_START_MS + reelDuration(2) + reelDelay(2) + 900);
    return () => clearTimeout(id);
  }, []);

  return (
    <div style={{
      display: "flex", justifyContent: "center", gap: 2,
      height: REEL_CELL,
      fontFamily: T.mono, fontSize: 50, fontWeight: 700,
      color: T.text,
    }}>
      {digits.map((d, i) => (
        <SlotDigit
          key={i}
          digit={d}
          delay={REEL_START_MS + reelDelay(i)}
          duration={reelDuration(i)}
          onStop={i === digits.length - 1 ? finish : undefined}
        />
      ))}
    </div>
  );
}

// The same faces holding a number that isn't spinning — the settled target,
// and the target on the result screen.
export function StaticNumber({ value, color = T.text, textShadow = "none", animation = "none", fontSize = 50 }) {
  return (
    <div style={{
      height: REEL_CELL,
      display: "flex", justifyContent: "center", gap: 2,
      fontFamily: T.mono, fontSize, fontWeight: 700,
      color, textShadow, animation,
    }}>
      {String(value).padStart(3, "0").split("").map((d, i) => (
        <ReelFace key={i}>
          <div style={{
            height: REEL_CELL, lineHeight: `${REEL_CELL}px`,
            textAlign: "center",
          }}>{d}</div>
        </ReelFace>
      ))}
    </div>
  );
}
