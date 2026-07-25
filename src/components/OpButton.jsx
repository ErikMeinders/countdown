import { useTheme } from "../theme-context.jsx";

export function OpButton({ op, onClick, active, enabled }) {
  const T = useTheme();
  return (
    <button onClick={onClick} disabled={!enabled} style={{
      width: 56, height: 56, borderRadius: T.r.md,
      border: `1.5px solid ${active ? T.gold : enabled ? T.hairStrong : T.hairFaint}`,
      background: active ? T.goldDim : enabled ? T.surfaceHi : T.surfaceFaint,
      color: active ? T.gold : enabled ? T.text : T.dim,
      // Heavier than the tiles' 700 would be, but these are glyphs rather than
      // numerals and thin ones disappear against the panel.
      fontSize: 31, fontWeight: 600, fontFamily: T.mono, lineHeight: 1,
      cursor: enabled ? "pointer" : "default",
      transition: "all 0.15s",
      boxShadow: active ? `0 0 16px ${T.goldGlow}` : "none",
    }}>
      {op}
    </button>
  );
}
