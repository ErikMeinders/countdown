import { useEffect, useMemo, useRef, useState } from "react";
import { DISPLAY } from "../theme.js";
import { REEL_START_MS } from "../constants.js";
import {
  REEL_CELL, REEL_EASE, REEL_LOOPS, REEL_WIDTH,
  reelDelay, reelDuration,
} from "../reels.js";

const EASE = `cubic-bezier(${REEL_EASE.join(",")})`;

// ── Slot reels ─────────────────────────────────────────────────
// A lit display, not a themed surface: dark faces and bright digits in either
// theme, like a real countdown clock, so its colours come from DISPLAY rather
// than the palette. Each digit is a strip of numerals inside a fixed window;
// the motion lives in reels.js, because the rattle follows the same curve.

// The window each digit sits in. Near-black so the lit digit has the most to
// push against, with a bright rim and top bevel to lift it off the well and a
// dark outer shadow so it reads as a window. Kept in step with the app icon
// (tools/make-icons.py).
const reelFaceStyle = {
  background: "rgba(0,2,6,0.98)",
  border: "1px solid rgba(255,255,255,0.40)",
  borderRadius: 3,
  boxShadow:
    "0 0 10px rgba(120,170,210,0.10)," +      // light spilling off the frame
    "0 2px 6px rgba(0,0,0,0.6)," +            // lift off the well
    "inset 0 1px 0 rgba(255,255,255,0.18)," + // bevel highlight
    "inset 0 0 16px rgba(0,0,0,0.85)",        // recess
  boxSizing: "border-box",
};

// A dark recessed well the reel cluster sits in, with a lit top edge. It gives
// the reels a consistent frame that stands out from whatever is behind it —
// the light panel in light mode, the dark one in dark — so the contrast the
// user asked for holds in both.
const reelWellStyle = {
  display: "inline-flex", gap: 2, justifyContent: "center",
  padding: "9px 11px",
  borderRadius: 9,
  background: "linear-gradient(180deg, #0b1019 0%, #05070d 100%)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow:
    "inset 0 2px 12px rgba(0,0,0,0.78)," +   // recess
    "0 1px 0 rgba(255,255,255,0.08)",         // lit top edge
};

// A digit sitting behind the glass glows faintly in its own colour, the way
// the target does in the app.
const reelGlow = (color) => `0 0 16px ${color}66`;

// Wraps a reel cluster in the well.
function ReelRow({ children }) {
  return <div style={reelWellStyle}>{children}</div>;
}

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
      {/* Fades the numerals out at the lip of the window — softened so it
          frames the digit without dimming it. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `linear-gradient(180deg,
          rgba(6,9,16,0.85) 0%, rgba(6,9,16,0) 22%,
          rgba(6,9,16,0) 78%, rgba(6,9,16,0.85) 100%)`,
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
    <ReelRow>
      <div style={{
        display: "flex", justifyContent: "center", gap: 2,
        height: REEL_CELL,
        fontFamily: DISPLAY.mono, fontSize: 50, fontWeight: 700,
        color: DISPLAY.text,
        textShadow: reelGlow(DISPLAY.text),
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
    </ReelRow>
  );
}

// The same faces holding a number that isn't spinning — the settled target,
// and the target on the result screen.
export function StaticNumber({ value, color = DISPLAY.text, textShadow = "none", animation = "none", fontSize = 50 }) {
  // Its own colour blooms behind the glass; any caller shadow (the urgency
  // halo) layers on top.
  const shadow = textShadow === "none" ? reelGlow(color) : `${textShadow}, ${reelGlow(color)}`;
  return (
    <ReelRow>
      <div style={{
        height: REEL_CELL,
        display: "flex", justifyContent: "center", gap: 2,
        fontFamily: DISPLAY.mono, fontSize, fontWeight: 700,
        color, textShadow: shadow, animation,
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
    </ReelRow>
  );
}
