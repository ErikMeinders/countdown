import { useEffect, useMemo, useRef, useState } from "react";
import { T } from "../theme.js";

// ── Slot reels ─────────────────────────────────────────────────
// Each digit is a tall strip of numerals inside a fixed window. The strip
// starts at the top and transitions to the cell holding the final digit,
// so the numerals blur past and decelerate into place. Reels are staggered
// and land left to right, the way a fruit machine settles.
export const REEL_CELL = 58;
const REEL_WIDTH = 36;
const REEL_LOOPS = 5;

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
    // transition is applied, otherwise it snaps straight to the end.
    let raf2;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setGo(true)); });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, []);

  return (
    <div style={{
      position: "relative", overflow: "hidden",
      height: REEL_CELL, width: REEL_WIDTH,
    }}>
      <div
        onTransitionEnd={(e) => {
          if (e.propertyName !== "transform") return;
          setSpinning(false);
          onStop?.();
        }}
        style={{
          transform: `translateY(${go ? -finalIdx * REEL_CELL : 0}px)`,
          transition: go
            ? `transform ${duration}ms cubic-bezier(.17,.72,.24,1) ${delay}ms`
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

      {/* Fades the numerals out at the lip of the window. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(180deg,
          rgba(10,13,22,0.95) 0%, rgba(10,13,22,0) 26%,
          rgba(10,13,22,0) 74%, rgba(10,13,22,0.95) 100%)`,
      }} />
    </div>
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

  // Safety net: if a transitionend is ever missed (backgrounded tab, reduced
  // motion overriding the transition) the clock still starts.
  useEffect(() => {
    const id = setTimeout(finish, 2600);
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
          delay={i * 200}
          duration={900 + i * 220}
          onStop={i === digits.length - 1 ? finish : undefined}
        />
      ))}
    </div>
  );
}
