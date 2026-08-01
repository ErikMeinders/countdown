import { DISPLAY } from "../theme.js";
import { useTheme } from "../theme-context.jsx";
import { labelStyle, panelStyle } from "../styles.js";
import { StaticNumber } from "./SlotNumber.jsx";
import { NumberTile } from "./NumberTile.jsx";

// One panel for the puzzle: the settled target reel and the tiles it was built
// from. Shared by the single-player and multiplayer result screens so the
// puzzle reads the same everywhere.
export function PuzzlePanel({ target, numbers, perfect = false }) {
  const T = useTheme();
  return (
    <div
      style={{
        ...panelStyle(T),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ ...labelStyle(T), marginBottom: 8 }}>Target</div>
        <StaticNumber value={target} color={perfect ? DISPLAY.gold : DISPLAY.cyan} fontSize={44} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        {(numbers || []).map((n, i) => (
          <NumberTile key={i} value={n} compact />
        ))}
      </div>
    </div>
  );
}
