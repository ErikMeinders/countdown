import { T } from "./theme.js";

// ── Shared Styles ──────────────────────────────────────────────
export const panelStyle = {
  background: T.panel,
  border: `1px solid ${T.panelBorder}`,
  borderRadius: T.r.lg,
  padding: 16,
  width: "100%",
  boxSizing: "border-box",
};

export const labelStyle = {
  fontSize: 10,
  letterSpacing: 2.5,
  color: T.muted,
  fontFamily: T.mono,
  textTransform: "uppercase",
  marginBottom: 8,
};

export const numBadge = (isCalc) => ({
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

export const ghostBtn = {
  padding: "10px 18px",
  borderRadius: T.r.md,
  border: `1px solid ${T.panelBorder}`,
  background: "transparent",
  color: T.mutedLight,
  fontSize: 13,
  fontWeight: 500,
  fontFamily: T.sans,
  cursor: "pointer",
  transition: "all 0.15s",
};

export const primaryBtn = {
  padding: "14px 40px",
  borderRadius: T.r.lg,
  border: "none",
  background: `linear-gradient(135deg, ${T.cyan}, ${T.violet})`,
  color: "#08101a",
  fontSize: 15,
  fontWeight: 700,
  fontFamily: T.sans,
  letterSpacing: 2,
  textTransform: "uppercase",
  cursor: "pointer",
  // Enough to lift it off the panel; a wider glow starts to look like the
  // button is the light source.
  boxShadow: `0 4px 18px ${T.cyanGlow}`,
  transition: "transform 0.1s",
};
