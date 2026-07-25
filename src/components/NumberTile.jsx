import { useRef } from "react";
import { useTheme } from "../theme-context.jsx";

export function NumberTile({ value, onClick, onDoubleClick, calculated, selected, compact, faded }) {
  const T = useTheme();
  const color = calculated ? T.orange : T.cyan;
  const lastTap = useRef(0);
  const size = compact ? 48 : 56;

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
  // Tint from the tile's own accent, so it deepens with the theme.
  const tint = (c) => `linear-gradient(160deg, ${c}22, ${c}08)`;

  return (
    <button onClick={handleTap} style={{
      width: size, height: size, borderRadius: T.r.md,
      border: faint
        ? `1.5px dashed ${T.hair}`
        : `1.5px solid ${selected ? T.gold : `${color}88`}`,
      background: faint
        ? "transparent"
        : selected
          ? T.goldDim
          : tint(color),
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
