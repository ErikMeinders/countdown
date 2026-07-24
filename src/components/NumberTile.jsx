import { useRef } from "react";
import { T } from "../theme.js";

export function NumberTile({ value, onClick, onDoubleClick, calculated, selected, compact, faded }) {
  const color = calculated ? T.orange : T.cyan;
  const lastTap = useRef(0);
  const size = compact ? 46 : 58;

  const handleTap = (e) => {
    if (!onDoubleClick) { onClick?.(); return; }
    const now = Date.now();
    if (now - lastTap.current < 350) {
      e.preventDefault();
      onDoubleClick();
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      onClick?.();
    }
  };

  const faint = faded && !selected;

  return (
    <button onClick={handleTap} style={{
      width: size, height: size, borderRadius: T.r.md,
      border: faint
        ? `1.5px dashed rgba(255,255,255,0.13)`
        : `1.5px solid ${selected ? T.gold : `${color}88`}`,
      background: faint
        ? "transparent"
        : selected
          ? T.goldDim
          : calculated
            ? "linear-gradient(160deg, rgba(232,150,75,0.14), rgba(232,150,75,0.04))"
            : "linear-gradient(160deg, rgba(63,216,200,0.13), rgba(63,216,200,0.03))",
      color: faint ? T.dim : selected ? T.gold : color,
      fontSize: compact ? 16 : 19,
      fontWeight: faint ? 500 : 700,
      fontFamily: T.mono,
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.18s",
      boxShadow: selected ? `0 0 16px ${T.goldGlow}` : "none",
    }}>
      {value}
    </button>
  );
}
