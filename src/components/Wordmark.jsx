import { useTheme } from "../theme-context.jsx";

// The one COUNTDOWN wordmark.
//
// It used to be written out twice: 26px with 7px tracking on the setup screen,
// 15px with 6px on every multiplayer screen. Two sizes is right — the mark
// should step back once you're in a room — but the tracking has to be
// proportional or it isn't the same mark, just the same word. Tracking is an
// em value in the palette, so both sizes are spaced identically.
export function Wordmark({ size = "lg", as: Tag = "div" }) {
  const T = useTheme();
  return (
    <Tag
      style={{
        fontFamily: T.sans,
        fontSize: size === "lg" ? T.type.xl : T.type.md,
        fontWeight: 700,
        letterSpacing: T.track.brand,
        // Tracking adds space after the final letter too, so a centred mark
        // sits visibly left of centre. Shift right by half a step to correct
        // it — half of track.brand.
        textIndent: "0.14em",
        color: T.text,
        opacity: 0.92,
        margin: 0,
        whiteSpace: "nowrap",
      }}
    >
      COUNTDOWN
    </Tag>
  );
}
