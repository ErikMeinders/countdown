// ── Design Tokens ──────────────────────────────────────────────
// Two palettes. The reels are a lit display and stay dark in both — like a
// real countdown clock, whose face doesn't change with the room — so their
// colours live in DISPLAY below, outside the theme. Everything else (the
// background, panels, text, buttons, tiles) comes from the active palette,
// supplied through theme-context.jsx.

// Structure shared by both palettes.
const SHARED = {
  mono: "'JetBrains Mono', 'SFMono-Regular', Consolas, monospace",
  sans: "'Outfit', 'Segoe UI', 'Helvetica Neue', sans-serif",
  r: { sm: 6, md: 12, lg: 16, pill: 999 },
  gap: { xs: 6, sm: 8, md: 12, lg: 18, xl: 26 },
};

export const PALETTES = {
  dark: {
    ...SHARED,
    scheme: "dark",

    cyan: "#43ddcd", cyanDim: "rgba(67,221,205,0.11)", cyanGlow: "rgba(67,221,205,0.20)",
    amber: "#e8b04b", ember: "#e2603f",
    orange: "#ec9b50", orangeDim: "rgba(236,155,80,0.13)", orangeGlow: "rgba(236,155,80,0.20)",
    gold: "#f4d46f", goldDim: "rgba(244,212,111,0.15)", goldGlow: "rgba(244,212,111,0.36)",
    red: "#e7656d", violet: "#9488dc",

    bg: "#080a12", bgMid: "#0c1220", bgLow: "#121a2b",
    panel: "rgba(255,255,255,0.034)", panelBorder: "rgba(255,255,255,0.095)",
    muted: "#667188", mutedLight: "#929db2",
    text: "#e5e9f1", textDim: "#afb8c8", dim: "#414c62",

    // Neutral overlays — hairlines and faint fills that are white on the dark
    // panel and flip to a dark tint on the light one, so they never wash out.
    hair: "rgba(255,255,255,0.14)", hairStrong: "rgba(255,255,255,0.26)",
    hairFaint: "rgba(255,255,255,0.06)",
    surfaceHi: "rgba(255,255,255,0.075)", surfaceLo: "rgba(255,255,255,0.03)",
    surfaceFaint: "rgba(255,255,255,0.015)",

    // Text that sits on a bright button, so it must contrast with the accent.
    onAccent: "#08101a",
  },

  light: {
    ...SHARED,
    scheme: "light",

    // Accents deepened so coloured text and borders hold up on a light panel,
    // while staying vivid enough to read on the dark reel face.
    cyan: "#0f9e8f", cyanDim: "rgba(15,158,143,0.12)", cyanGlow: "rgba(15,158,143,0.24)",
    amber: "#bd8420", ember: "#c8471f",
    orange: "#c06f1f", orangeDim: "rgba(192,111,31,0.13)", orangeGlow: "rgba(192,111,31,0.22)",
    gold: "#a9841a", goldDim: "rgba(169,132,26,0.16)", goldGlow: "rgba(169,132,26,0.30)",
    red: "#cc424e", violet: "#5b50c4",

    bg: "#eef1f7", bgMid: "#e6ebf3", bgLow: "#dce2ee",
    panel: "rgba(22,30,52,0.045)", panelBorder: "rgba(22,30,52,0.14)",
    muted: "#5c6678", mutedLight: "#454e63",
    text: "#1a2232", textDim: "#414c60", dim: "#a7afc0",

    hair: "rgba(26,34,56,0.16)", hairStrong: "rgba(26,34,56,0.30)",
    hairFaint: "rgba(26,34,56,0.08)",
    surfaceHi: "rgba(26,34,56,0.06)", surfaceLo: "rgba(26,34,56,0.025)",
    surfaceFaint: "rgba(26,34,56,0.02)",

    onAccent: "#f4f7fc",
  },
};

// The reel display never themes. Digits and the timer ring read against a
// near-black window in either mode, so they keep their bright dark-mode values.
export const DISPLAY = {
  text: "#e5e9f1",
  cyan: "#43ddcd",
  amber: "#e8b04b",
  ember: "#e2603f",
  gold: "#f4d46f",
  mono: SHARED.mono,
};

export function themeFor(scheme) {
  return PALETTES[scheme] || PALETTES.dark;
}

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
// Calm → warm → hot as time drains. Reads off DISPLAY: the ring and the digit
// it colours sit on the dark reel, so it doesn't follow the theme.
export function urgencyColor(pct) {
  if (pct > 0.5) return DISPLAY.cyan;
  if (pct > 0.2) return mix(DISPLAY.cyan, DISPLAY.amber, (0.5 - pct) / 0.3);
  return mix(DISPLAY.amber, DISPLAY.ember, (0.2 - pct) / 0.2);
}
