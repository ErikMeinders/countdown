// ── Shared Styles ──────────────────────────────────────────────
// Factories rather than constants: each takes the active palette (T) so the
// same panel or button restyles when the theme changes. Call them inside a
// component that has `const T = useTheme()`.
//
// Buttons follow one hierarchy, no gradients:
//   primary   — solid accent, one commit action per screen (Submit, New Round)
//   secondary — outline (Reset, How to play)
//   tertiary  — quiet text, lightest touch (Cancel)
//   segmented — one-of-N pill (Authentic / Solvable)
// Board cells (tiles, operators) and the icon toggles are their own sizes,
// styled in their components. Everything lands on the 4px grid.

export const panelStyle = (T) => ({
  background: T.panel,
  border: `1px solid ${T.panelBorder}`,
  borderRadius: T.r.lg,
  padding: 16,
  width: "100%",
  boxSizing: "border-box",
  // A hairline of light along the top edge, so panels feel lit rather than
  // printed on. Barely there, but it's what keeps the flat scheme from
  // reading as dead.
  boxShadow: `inset 0 1px 0 ${T.hairFaint}`,
});

// The primary key's fill: a single-hue vertical shade with a fine top sheen
// and a soft accent shadow. Reads as a lit, physical surface — the depth the
// flat solid was missing — without the two-hue diagonal that looked generic.
const accentFill = (T) => ({
  background: `linear-gradient(180deg, ${T.accentHi}, ${T.accentLo})`,
  boxShadow: `0 2px 12px ${T.cyanGlow}, inset 0 1px 0 rgba(255,255,255,0.3)`,
});

export const labelStyle = (T) => ({
  fontSize: 10,
  letterSpacing: 2.5,
  color: T.muted,
  fontFamily: T.mono,
  textTransform: "uppercase",
  marginBottom: 8,
});

export const numBadge = (T, isCalc) => ({
  display: "inline-block",
  padding: "2px 7px",
  borderRadius: T.r.sm,
  border: `1px solid ${isCalc ? T.orange : T.cyan}`,
  background: isCalc ? T.orangeDim : T.cyanDim,
  color: isCalc ? T.orange : T.cyan,
  fontWeight: 700,
  fontSize: 14,
  fontFamily: T.mono,
});

// Shared skeleton for the text buttons, so a row of them lines up.
const btnBase = (T) => ({
  height: 44,
  padding: "0 20px",
  borderRadius: T.r.md,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: T.sans,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 0.15s",
  boxSizing: "border-box",
});

export const primaryBtn = (T) => ({
  ...btnBase(T),
  height: 52,
  padding: "0 28px",
  border: "none",
  color: T.onAccent,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  ...accentFill(T),            // the one lit element per screen
});

export const secondaryBtn = (T) => ({
  ...btnBase(T),
  border: `1px solid ${T.hairStrong}`,
  background: "transparent",
  color: T.text,
});

// Boxed like the rest, but with the faintest border and muted text, so it's
// clearly the lightest of the three without floating unframed.
export const tertiaryBtn = (T) => ({
  ...btnBase(T),
  border: `1px solid ${T.panelBorder}`,
  background: "transparent",
  color: T.muted,
});

// A filled key at row height, so Submit reads as the commit action without
// standing taller than the outline buttons beside it.
export const filledRowBtn = (T) => ({
  ...btnBase(T),
  border: "none",
  color: T.onAccent,
  fontWeight: 700,
  ...accentFill(T),
});

export const segmentedBox = (T) => ({
  display: "flex",
  gap: 4,
  background: T.surfaceLo,
  borderRadius: T.r.md,
  padding: 4,
});

export const segmentedItem = (T, on) => ({
  flex: 1,
  height: 40,
  borderRadius: T.r.sm,
  border: `1px solid ${on ? T.cyan : "transparent"}`,
  background: on ? T.cyanDim : "transparent",
  color: on ? T.cyan : T.muted,
  fontFamily: T.sans,
  fontSize: 13,
  fontWeight: on ? 700 : 500,
  cursor: "pointer",
  transition: "all 0.18s",
});
