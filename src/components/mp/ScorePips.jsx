import { useTheme } from "../../theme-context.jsx";

// A row of pips per player: filled for rounds won, hollow for the rest. Compact
// by design — a phone status line, not a desktop scoreboard.
export function ScorePips({ name, wins, needed, highlight }) {
  const T = useTheme();
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span
        style={{
          fontFamily: T.sans,
          fontSize: 14,
          fontWeight: highlight ? 700 : 500,
          color: highlight ? T.text : T.mutedLight,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
      <span aria-label={`${wins} of ${needed} rounds won`} style={{ display: "inline-flex", gap: 5 }}>
        {Array.from({ length: needed }, (_, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: i < wins ? T.cyan : "transparent",
              border: `1.5px solid ${i < wins ? T.cyan : T.hairStrong}`,
              boxShadow: i < wins ? `0 0 8px ${T.cyanGlow}` : "none",
            }}
          />
        ))}
      </span>
    </div>
  );
}
