// ── Design Tokens ──────────────────────────────────────────────
export const T = {
  cyan:        "#43ddcd",
  cyanDim:     "rgba(67,221,205,0.11)",
  cyanGlow:    "rgba(67,221,205,0.20)",
  amber:       "#e8b04b",
  ember:       "#e2603f",
  orange:      "#ec9b50",
  orangeDim:   "rgba(236,155,80,0.13)",
  orangeGlow:  "rgba(236,155,80,0.20)",
  gold:        "#f4d46f",
  goldDim:     "rgba(244,212,111,0.15)",
  goldGlow:    "rgba(244,212,111,0.36)",
  red:         "#e7656d",
  violet:      "#9488dc",

  bg:          "#080a12",
  bgMid:       "#0c1220",
  bgLow:       "#121a2b",
  panel:       "rgba(255,255,255,0.034)",
  panelBorder: "rgba(255,255,255,0.095)",
  muted:       "#667188",
  mutedLight:  "#929db2",
  text:        "#e5e9f1",
  textDim:     "#afb8c8",
  dim:         "#414c62",

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
