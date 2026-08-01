import { useTheme } from "../theme-context.jsx";
import { StepColumn } from "./StepColumn.jsx";

// One solution as a card: who it belongs to, the value and how close it landed,
// and the working shown as color-coded steps — the same long style the
// single-player game uses, for humans and the computer alike.
export function ResultCard({ card, target }) {
  const T = useTheme();
  const win = card.isWinner;
  const accent = win ? T.gold : card.kind === "computer" ? T.violet : T.cyan;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 18,
        minHeight: 220,
        borderRadius: T.r.lg,
        border: `1px solid ${win ? `${T.gold}66` : T.panelBorder}`,
        background: T.panel,
        boxShadow: win ? `0 0 20px ${T.goldGlow}` : `inset 0 1px 0 ${T.hairFaint}`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, color: T.text }}>{card.name}</span>
        {win && (
          <span
            style={{
              fontFamily: T.mono,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: T.gold,
              border: `1px solid ${T.gold}66`,
              borderRadius: T.r.sm,
              padding: "2px 7px",
            }}
          >
            Round win
          </span>
        )}
      </div>

      {card.submitted ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontFamily: T.mono, fontSize: 32, fontWeight: 700, color: accent }}>
              {card.value ?? "—"}
            </span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.mutedLight }}>
              {card.exact ? "exact" : card.distance != null ? `${card.distance} from ${target}` : ""}
            </span>
          </div>
          <StepColumn
            steps={card.steps || []}
            label={
              typeof card.operations === "number"
                ? `${card.operations} op${card.operations === 1 ? "" : "s"}`
                : "working"
            }
            accent={accent}
            target={target}
            empty="a source number was closest"
          />
        </>
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center", fontFamily: T.sans, fontSize: 14, color: T.muted }}>
          No answer submitted
        </div>
      )}
    </div>
  );
}
