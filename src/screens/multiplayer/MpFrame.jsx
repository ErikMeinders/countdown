import { useTheme } from "../../theme-context.jsx";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { ConnectionBadge } from "../../components/mp/ConnectionBadge.jsx";
import { PersonIcon } from "../../components/mp/PersonIcon.jsx";

// Shared shell for every multiplayer screen. The header carries the theme
// toggle and, next to it, a single-person icon that returns to solo play — the
// deliberate replacement for the old "‹ Leave" text link. The COUNTDOWN
// wordmark keeps the game's identity on every screen.
export function MpFrame({ title, subtitle, connectionState, onLeave, children }) {
  const T = useTheme();
  return (
    <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ position: "relative", width: "100%", height: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ThemeToggle />
          <span style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 700, letterSpacing: 6, color: T.text, opacity: 0.92 }}>
            COUNTDOWN
          </span>
          {onLeave && (
            <button
              onClick={onLeave}
              aria-label="Back to single player"
              title="Back to single player"
              style={{
                position: "absolute",
                top: 2,
                right: 0,
                width: 36,
                height: 36,
                borderRadius: T.r.md,
                border: `1px solid ${T.panelBorder}`,
                background: "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              <PersonIcon variant="single" size={18} color={T.mutedLight} />
            </button>
          )}
        </div>
        {title && (
          <div style={{ fontFamily: T.sans, fontSize: 17, fontWeight: 700, letterSpacing: 1, color: T.text }}>
            {title}
          </div>
        )}
        {connectionState && <ConnectionBadge state={connectionState} />}
        {subtitle && <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted }}>{subtitle}</div>}
      </header>
      {children}
    </div>
  );
}
