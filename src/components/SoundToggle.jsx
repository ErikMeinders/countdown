import { useTheme } from "../theme-context.jsx";

// Drawn rather than an emoji: 🔊/🔇 render at a different size, weight and
// colour on every platform, and on iOS they arrive in full colour, which is
// the one thing on the screen that isn't part of the palette.
export function SoundToggle({ muted, onToggle }) {
  const T = useTheme();
  const stroke = muted ? T.dim : T.mutedLight;

  return (
    <button
      onClick={onToggle}
      aria-label={muted ? "Unmute" : "Mute"}
      aria-pressed={muted}
      style={{
        position: "absolute", top: -2, right: 0,
        width: 34, height: 34, borderRadius: T.r.md,
        border: `1px solid ${T.panelBorder}`,
        background: "transparent",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"
          fill={stroke} stroke={stroke} strokeWidth="1.6" strokeLinejoin="round"
        />
        {muted ? (
          <path d="M16 9.5l5 5m0-5l-5 5"
            stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        ) : (
          <>
            <path d="M15.8 9.2a4 4 0 0 1 0 5.6"
              stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
            <path d="M18.4 6.8a7.5 7.5 0 0 1 0 10.4"
              stroke={stroke} strokeWidth="1.7" strokeLinecap="round" />
          </>
        )}
      </svg>
    </button>
  );
}
