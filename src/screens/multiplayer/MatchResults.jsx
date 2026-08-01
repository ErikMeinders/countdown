import { useTheme } from "../../theme-context.jsx";
import { primaryBtn, secondaryBtn } from "../../styles.js";
import { MpFrame } from "./MpFrame.jsx";

// End of the match. The backend has declared the winner; we show the final
// score and the ways out. There is no in-place rematch in the backend yet (see
// README), so "New game" returns to the multiplayer landing rather than
// pretending to restart the same room.
export function MatchResults({ result, room, match, playerId, onLeave, onNewGame }) {
  const T = useTheme();
  const players = room.players || [];
  const scores = result.scores || {};
  const winnerId = result.matchWinnerId;
  const iWon = winnerId === playerId;
  const winnerName = iWon ? "You" : players.find((p) => p.playerId === winnerId)?.displayName || "Opponent";

  // Present the score as "winner–loser".
  const sortedScores = players
    .map((p) => scores[p.playerId] || 0)
    .sort((a, b) => b - a);
  const scoreline = sortedScores.join("–");

  return (
    <MpFrame title="Match complete" onLeave={onLeave} leaveLabel="Leave">
      <div
        style={{
          textAlign: "center",
          padding: "28px 16px",
          borderRadius: T.r.lg,
          border: `1px solid ${T.gold}66`,
          background: T.panel,
          boxShadow: `0 0 24px ${T.goldGlow}`,
        }}
      >
        <div style={{ fontFamily: T.sans, fontSize: 26, fontWeight: 800, color: T.gold }}>
          {winnerName} {iWon ? "win" : "wins"} {scoreline}
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 12, color: T.mutedLight, marginTop: 8 }}>
          Best of {match?.bestOf ?? 5}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: T.gap.md }}>
        <button onClick={onNewGame} style={{ ...primaryBtn(T), width: "100%" }}>
          New game
        </button>
        <button onClick={onLeave} style={{ ...secondaryBtn(T), width: "100%" }}>
          Leave room
        </button>
      </div>
    </MpFrame>
  );
}
