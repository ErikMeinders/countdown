// ── Design Tokens ──────────────────────────────────────────────
export const T = {
  cyan:        "#3fd8c8",
  cyanDim:     "rgba(63,216,200,0.10)",
  cyanGlow:    "rgba(63,216,200,0.18)",
  amber:       "#e8b04b",
  ember:       "#e2603f",
  orange:      "#e8964b",
  orangeDim:   "rgba(232,150,75,0.12)",
  orangeGlow:  "rgba(232,150,75,0.18)",
  gold:        "#f2d16b",
  goldDim:     "rgba(242,209,107,0.14)",
  goldGlow:    "rgba(242,209,107,0.35)",
  red:         "#e2545c",
  violet:      "#8b7fd4",

  bg:          "#080a12",
  bgMid:       "#0c1220",
  bgLow:       "#121a2b",
  panel:       "rgba(255,255,255,0.028)",
  panelBorder: "rgba(255,255,255,0.07)",
  muted:       "#5a6478",
  mutedLight:  "#8892a6",
  text:        "#dfe4ee",
  textDim:     "#a4adbe",
  dim:         "#333c4e",

  mono:        "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
  sans:        "'Outfit', 'Segoe UI', 'Helvetica Neue', sans-serif",

  r: { sm: 6, md: 12, lg: 16, pill: 999 },
  gap: { xs: 6, sm: 8, md: 12, lg: 18, xl: 26 },
};

// ── Colour helpers ─────────────────────────────────────────────
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * Math.max(0, Math.min(1, t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Calm → warm → hot as time drains
export function urgencyColor(pct) {
  if (pct > 0.5) return T.cyan;
  if (pct > 0.2) return mix(T.cyan, T.amber, (0.5 - pct) / 0.3);
  return mix(T.amber, T.ember, (0.2 - pct) / 0.2);
}
