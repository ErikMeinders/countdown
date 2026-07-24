import { useLayoutEffect, useRef, useState } from "react";
import { T, urgencyColor } from "../theme.js";
import { labelStyle } from "../styles.js";
import { SlotNumber, StaticNumber } from "./SlotNumber.jsx";

// Timer drawn as a depleting stroke around the target card.
export function TargetPanel({ target, seconds, total, running, finished, perfect, revealing, roundId, onRevealed }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pct = total > 0 ? Math.max(0, seconds) / total : 0;
  const color = finished ? (perfect ? T.gold : T.cyan) : urgencyColor(pct);
  const urgent = running && seconds <= 10;
  const critical = running && seconds <= 5;

  const SW = 3;
  const { w, h } = size;
  const r = Math.max(0, Math.min(T.r.lg, Math.min(w, h) / 2 - SW / 2));
  const iw = Math.max(0, w - SW);
  const ih = Math.max(0, h - SW);
  const perim = 2 * (iw - 2 * r) + 2 * (ih - 2 * r) + 2 * Math.PI * r;

  return (
    <div
      ref={ref}
      style={{
        position: "relative",
        width: "100%",
        boxSizing: "border-box",
        padding: "18px 24px 16px",
        borderRadius: T.r.lg,
        // Lifted well clear of the near-black reel faces, so the digits read
        // as lit windows set into the panel rather than holes in it.
        background: `radial-gradient(120% 140% at 50% 0%, ${
          finished && perfect ? "rgba(244,212,111,0.12)" : "rgba(255,255,255,0.075)"
        } 0%, rgba(255,255,255,0.03) 60%)`,
        border: "1px solid rgba(255,255,255,0.14)",
        textAlign: "center",
        boxShadow: urgent ? `0 0 ${18 + (10 - seconds) * 3}px ${color}22` : "none",
        transition: "box-shadow 0.4s ease",
      }}
    >
      {w > 0 && (
        <svg
          width={w} height={h}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
        >
          <rect
            x={SW / 2} y={SW / 2} width={iw} height={ih} rx={r} ry={r}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={SW}
          />
          {running && (
            <rect
              x={SW / 2} y={SW / 2} width={iw} height={ih} rx={r} ry={r}
              fill="none"
              stroke={color}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={perim}
              strokeDashoffset={perim * (1 - pct)}
              style={{
                transition: "stroke-dashoffset 1s linear, stroke 0.9s ease",
                filter: urgent ? `drop-shadow(0 0 5px ${color})` : "none",
              }}
            />
          )}
        </svg>
      )}

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, marginBottom: 2,
      }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>Target</span>
        {running && (
          <span style={{
            fontFamily: T.mono, fontSize: 11, fontWeight: 700,
            color, letterSpacing: 1,
            opacity: urgent ? 1 : 0.65,
            animation: critical ? "beat 1s ease-in-out infinite" : "none",
          }}>
            {seconds}s
          </span>
        )}
      </div>

      {revealing ? (
        <SlotNumber key={roundId} value={target} onSettle={onRevealed} />
      ) : (
        <StaticNumber
          value={target}
          color={finished ? (perfect ? T.gold : T.cyan) : urgent ? color : T.text}
          textShadow={urgent ? `0 0 22px ${color}55` : "none"}
          animation={critical ? "beat 1s ease-in-out infinite" : "none"}
        />
      )}
    </div>
  );
}
