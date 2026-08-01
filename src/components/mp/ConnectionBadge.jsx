import { useTheme } from "../../theme-context.jsx";

// A compact connection indicator: a coloured dot and a word. Reads the machine's
// connectionState directly so every screen shows the same truth.
const LABELS = {
  idle: "Offline",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  error: "Connection error",
};

export function ConnectionBadge({ state }) {
  const T = useTheme();
  const color =
    state === "connected"
      ? T.cyan
      : state === "reconnecting" || state === "connecting"
        ? T.gold
        : state === "error" || state === "disconnected"
          ? T.red
          : T.muted;
  const pulsing = state === "connecting" || state === "reconnecting";
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: T.mono,
        fontSize: 11,
        color: T.mutedLight,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
          animation: pulsing ? "beat 1s ease-in-out infinite" : "none",
        }}
      />
      {LABELS[state] || state}
    </span>
  );
}
