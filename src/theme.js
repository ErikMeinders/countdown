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
  // 4px grid: every gap is a multiple, so spacing lands consistently.
  gap: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },

  // Type scale — five steps, and nothing between them. The screens had grown
  // 10/12/13/14/15/17/26 by picking whatever looked right locally; 13 against
  // 14 against 15 isn't a distinction anyone can see, it's just drift. A size
  // that isn't one of these is a bug.
  //   xs  overline labels        sm  meta and secondary prose
  //   md  every control and body lg  screen titles
  //   xl  the wordmark
  type: { xs: 10, sm: 12, md: 15, lg: 18, xl: 26 },

  // Tracking, in em so it holds at any size — the wordmark is the same letter
  // spacing at 26px and at 15px, which is what makes it read as one mark
  // rather than two. Previously 1/1.5/2/2.5/6/7px, unrelated to each other.
  track: { ui: "0.07em", label: "0.2em", brand: "0.28em" },

  // Square tap targets for the icon-only controls (theme, sound, leave).
  control: 36,
};

export const PALETTES = {
  dark: {
    ...SHARED,
    scheme: "dark",

    cyan: "#43ddcd", cyanDim: "rgba(67,221,205,0.11)", cyanGlow: "rgba(67,221,205,0.22)",
    // Tonal pair for the primary key — a single-hue vertical shade, not the
    // old two-hue diagonal that read as generic gradient.
    accentHi: "#5ce8da", accentLo: "#37ccbc",
    amber: "#e8b04b", ember: "#e2603f",
    orange: "#ec9b50", orangeDim: "rgba(236,155,80,0.13)", orangeGlow: "rgba(236,155,80,0.20)",
    gold: "#f4d46f", goldDim: "rgba(244,212,111,0.15)", goldGlow: "rgba(244,212,111,0.36)",
    red: "#e7656d", violet: "#9488dc",

    // A touch more luminance and indigo at the top of the radial, so the
    // screen glows gently rather than reading as flat black.
    bg: "#080a12", bgMid: "#0c1322", bgLow: "#18233c",
    panel: "rgba(255,255,255,0.04)", panelBorder: "rgba(255,255,255,0.11)",
    muted: "#667188", mutedLight: "#929db2",
    text: "#e5e9f1", textDim: "#afb8c8", dim: "#414c62",

    // Neutral overlays — hairlines and faint fills that are white on the dark
    // panel and flip to a dark tint on the light one, so they never wash out.
    hair: "rgba(255,255,255,0.14)", hairStrong: "rgba(255,255,255,0.26)",
    hairFaint: "rgba(255,255,255,0.06)",
    surfaceHi: "rgba(255,255,255,0.08)", surfaceLo: "rgba(255,255,255,0.03)",
    surfaceFaint: "rgba(255,255,255,0.015)",

    // Text that sits on a bright button, so it must contrast with the accent.
    onAccent: "#08101a",
  },

  light: {
    ...SHARED,
    scheme: "light",

    // Accents deepened so coloured text and borders hold up on a light panel,
    // while staying vivid enough to read on the dark reel face.
    //
    // Deepened a second time, against measured contrast rather than by eye.
    // These colours are used as *text on their own tint* — the selected pill,
    // the number badge, the active segment — and the first pass only checked
    // them against the page background. On the tint they were landing at
    // 2.3:1, half of what body text needs. Each is now the lightest value that
    // clears 4.5:1 where it is actually used. The tints themselves keep their
    // original hue, so the surfaces stay as airy as before.
    cyan: "#0a685e", cyanDim: "rgba(15,158,143,0.12)", cyanGlow: "rgba(15,158,143,0.28)",
    // White on the primary key: both ends of the gradient clear 4.5:1.
    accentHi: "#0a7a6e", accentLo: "#086057",
    amber: "#845c16", ember: "#c8471f",
    orange: "#864e16", orangeDim: "rgba(192,111,31,0.13)", orangeGlow: "rgba(192,111,31,0.22)",
    gold: "#705711", goldDim: "rgba(169,132,26,0.16)", goldGlow: "rgba(169,132,26,0.30)",
    red: "#b13944", violet: "#5b50c4",

    bg: "#eef1f7", bgMid: "#e6ebf3", bgLow: "#dbe2ef",
    panel: "rgba(22,30,52,0.05)", panelBorder: "rgba(22,30,52,0.16)",
    muted: "#5c6678", mutedLight: "#454e63",
    text: "#1a2232", textDim: "#414c60", dim: "#a7afc0",

    // Strengthened: at 0.16 the unselected pills were a barely-visible outline
    // on the light background, so a row of choices read as one empty area with
    // one option floating in it. The dark palette never had this problem —
    // white at 0.14 on near-black is a much stronger edge than navy at 0.16 on
    // near-white.
    hair: "rgba(26,34,56,0.26)", hairStrong: "rgba(26,34,56,0.38)",
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
