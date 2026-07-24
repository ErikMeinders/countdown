import { T } from "../theme.js";

export function OpButton({ op, onClick, active, enabled }) {
  return (
    <button onClick={onClick} disabled={!enabled} style={{
      width: 64, height: 64, borderRadius: T.r.md,
      border: `1.5px solid ${active ? T.gold : enabled ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"}`,
      background: active ? T.goldDim : "rgba(255,255,255,0.02)",
      color: active ? T.gold : enabled ? T.textDim : T.dim,
      fontSize: 26, fontWeight: 500, fontFamily: T.mono,
      cursor: enabled ? "pointer" : "default",
      transition: "all 0.15s",
      boxShadow: active ? `0 0 16px ${T.goldGlow}` : "none",
    }}>
      {op}
    </button>
  );
}
