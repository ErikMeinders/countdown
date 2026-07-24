import { T } from "../theme.js";
import { reelFaceStyle, REEL_FADE } from "./SlotNumber.jsx";

// The mute control wears the same recessed reel face as the target spinner,
// so it reads as part of the machine rather than a stray UI button. The
// speaker sits behind the glass like a numeral: full strength when sound is
// on, dimmed and struck through when off.
export function SoundToggle({ muted, onToggle }) {
  const glyph = muted ? T.dim : T.text;

  return (
    <button
      onClick={onToggle}
      aria-label={muted ? "Unmute" : "Mute"}
      aria-pressed={muted}
      style={{
        ...reelFaceStyle,
        position: "absolute", top: -2, right: 0,
        width: 34, height: 34,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"
        style={{ position: "relative", zIndex: 1 }}>
        <path
          d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"
          fill={glyph} stroke={glyph} strokeWidth="1.6" strokeLinejoin="round"
        />
        {muted ? (
          <path d="M16 9.5l5 5m0-5l-5 5"
            stroke={glyph} strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.8 9.2a4 4 0 0 1 0 5.6"
              stroke={glyph} strokeWidth="1.7" strokeLinecap="round" />
            <path d="M18.4 6.8a7.5 7.5 0 0 1 0 10.4"
              stroke={glyph} strokeWidth="1.7" strokeLinecap="round" />
          </>
        )}
      </svg>

      {/* Same lip fade as the reel windows. */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: REEL_FADE,
      }} />
    </button>
  );
}
