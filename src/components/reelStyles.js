// ── Reel surfaces ──────────────────────────────────────────────
// The look of the display, kept apart from the component that animates it —
// the same split reels.js already makes for the motion, and for the same
// reason: the sound, the app icon and the design-system card all need these
// values, and a second copy is a copy that will disagree.
//
// A lit display, not a themed surface. Dark faces and bright digits in either
// theme, like a real countdown clock, so the colours come from DISPLAY rather
// than the palette.

// The window each digit sits in. Near-black so the lit digit has the most to
// push against, with a bright rim and top bevel to lift it off the well and a
// dark outer shadow so it reads as a window. Kept in step with the app icon
// (tools/make-icons.py).
export const reelFaceStyle = {
  background: "rgba(0,2,6,0.98)",
  border: "1px solid rgba(255,255,255,0.40)",
  borderRadius: 3,
  boxShadow:
    "0 0 10px rgba(120,170,210,0.10)," +      // light spilling off the frame
    "0 2px 6px rgba(0,0,0,0.6)," +            // lift off the well
    "inset 0 1px 0 rgba(255,255,255,0.18)," + // bevel highlight
    "inset 0 0 16px rgba(0,0,0,0.85)",        // recess
  boxSizing: "border-box",
};

// A dark recessed well the reel cluster sits in, with a lit top edge. It gives
// the reels a consistent frame that stands out from whatever is behind it —
// the light panel in light mode, the dark one in dark — so the contrast holds
// in both.
export const reelWellStyle = {
  display: "inline-flex", gap: 2, justifyContent: "center",
  padding: "9px 11px",
  borderRadius: 9,
  background: "linear-gradient(180deg, #0b1019 0%, #05070d 100%)",
  border: "1px solid rgba(255,255,255,0.09)",
  boxShadow:
    "inset 0 2px 12px rgba(0,0,0,0.78)," +   // recess
    "0 1px 0 rgba(255,255,255,0.08)",         // lit top edge
};

// A digit sitting behind the glass glows faintly in its own colour, the way
// the target does in the app.
export const reelGlow = (color) => `0 0 16px ${color}66`;

// Fades the numerals out at the lip of the window — softened so it frames the
// digit without dimming it.
export const reelLipStyle = {
  position: "absolute", inset: 0, pointerEvents: "none",
  background: `linear-gradient(180deg,
    rgba(6,9,16,0.85) 0%, rgba(6,9,16,0) 22%,
    rgba(6,9,16,0) 78%, rgba(6,9,16,0.85) 100%)`,
};
