import { useTheme, useThemeControls } from "../theme-context.jsx";

// Same drawn-SVG treatment as the sound toggle, mirrored to the top-left.
// One tap cycles auto → light → dark: a sun for light, a moon for dark, and a
// split disc for auto (following the system).
const NEXT = { auto: "light", light: "dark", dark: "auto" };
const LABEL = { auto: "Theme: auto", light: "Theme: light", dark: "Theme: dark" };

export function ThemeToggle() {
  const T = useTheme();
  const { mode, setMode } = useThemeControls();
  const stroke = T.mutedLight;

  return (
    <button
      onClick={() => setMode(NEXT[mode])}
      aria-label={`${LABEL[mode]} (tap to change)`}
      style={{
        position: "absolute", top: 4, left: 0,
        width: 36, height: 36, borderRadius: T.r.md,
        border: `1px solid ${T.panelBorder}`,
        background: "transparent",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 0,
      }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {mode === "light" && (
          <>
            <circle cx="12" cy="12" r="4.6" fill={stroke} />
            <g stroke={stroke} strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4" />
              <path d="M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
            </g>
          </>
        )}
        {mode === "dark" && (
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z"
            fill={stroke} />
        )}
        {mode === "auto" && (
          <>
            {/* A disc split down the middle: filled half = follow the system. */}
            <circle cx="12" cy="12" r="7.4" fill="none" stroke={stroke} strokeWidth="1.7" />
            <path d="M12 4.6a7.4 7.4 0 0 0 0 14.8z" fill={stroke} />
          </>
        )}
      </svg>
    </button>
  );
}
