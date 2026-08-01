import { useTheme } from "../../theme-context.jsx";
import { iconBtn } from "../../styles.js";
import { ThemeToggle } from "../../components/ThemeToggle.jsx";
import { Wordmark } from "../../components/Wordmark.jsx";
import { ConnectionBadge } from "../../components/mp/ConnectionBadge.jsx";
import { PersonIcon } from "../../components/mp/PersonIcon.jsx";

// Shared shell for every multiplayer screen. The header carries the theme
// toggle and, next to it, a single-person icon that returns to solo play — the
// deliberate replacement for the old "‹ Leave" text link. The COUNTDOWN
// wordmark keeps the game's identity on every screen.
export function MpFrame({ title, subtitle, connectionState, onLeave, children }) {
  const T = useTheme();
  return (
    <div style={{ width: "100%", maxWidth: 420, flex: 1, display: "flex", flexDirection: "column" }}>
      {/* The brand bar pins to the top — same 44px band as the single-player
          screen, so the wordmark and the corner controls don't jump when you
          switch modes. */}
      <div style={{ position: "relative", width: "100%", height: 44, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: T.gap.lg }}>
        <ThemeToggle />
        <Wordmark size="sm" />
        {onLeave && (
          <button
            onClick={onLeave}
            aria-label="Back to single player"
            title="Back to single player"
            style={{ ...iconBtn(T), position: "absolute", top: 4, right: 0 }}
          >
            <PersonIcon variant="single" size={18} color={T.mutedLight} />
          </button>
        )}
      </div>

      {/* Everything else is one group, centred in the height that's left.
          The screen title belongs to the body, not to the brand bar: centring
          the body alone left the title stranded at the top with a hole under
          it. Auto margins collapse when the content is tall, so a long screen
          simply starts under the bar and nothing is clipped. */}
      <div
        style={{
          width: "100%",
          marginTop: "auto",
          marginBottom: "auto",
          display: "flex",
          flexDirection: "column",
          gap: T.gap.lg,
        }}
      >
        {(title || connectionState || subtitle) && (
          <header style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: T.gap.sm }}>
            {title && (
              <div style={{ fontFamily: T.sans, fontSize: T.type.lg, fontWeight: 700, letterSpacing: T.track.ui, color: T.text }}>
                {title}
              </div>
            )}
            {connectionState && <ConnectionBadge state={connectionState} />}
            {subtitle && <div style={{ fontFamily: T.mono, fontSize: T.type.sm, color: T.muted }}>{subtitle}</div>}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
