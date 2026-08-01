import { useEffect, useMemo, useRef, useState } from "react";
import { DISPLAY } from "../theme.js";
import { REEL_START_MS } from "../constants.js";
import {
  REEL_CELL, REEL_EASE, REEL_LOOPS, REEL_WIDTH,
  reelDelay, reelDuration,
} from "../reels.js";
import { reelFaceStyle, reelGlow, reelLipStyle, reelWellStyle } from "./reelStyles.js";

const EASE = `cubic-bezier(${REEL_EASE.join(",")})`;

// ── Slot reels ─────────────────────────────────────────────────
// Each digit is a strip of numerals inside a fixed window. The motion lives in
// reels.js, because the rattle follows the same curve; the surfaces live in
// reelStyles.js, because the design-system card needs them too.

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
      <div style={reelLipStyle} />
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
