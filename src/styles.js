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
  background: T.cyan,           // solid — the one saturated element per screen
  color: T.onAccent,
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: 1.5,
  textTransform: "uppercase",
});

export const secondaryBtn = (T) => ({
  ...btnBase(T),
  border: `1px solid ${T.hairStrong}`,
  background: "transparent",
  color: T.text,
});

export const tertiaryBtn = (T) => ({
  ...btnBase(T),
  border: "1px solid transparent",   // transparent, not none, so heights match
  background: "transparent",
  color: T.muted,
});

// A filled button at row height, so Submit reads as the commit action without
// standing taller than the outline buttons beside it.
export const filledRowBtn = (T) => ({
  ...btnBase(T),
  border: "none",
  background: T.cyan,
  color: T.onAccent,
  fontWeight: 700,
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
