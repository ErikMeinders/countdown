import { useEffect } from "react";

import { solve } from "../../game/solver.js";
import { orderResultCards } from "../../game/multiplayer/results.js";
import { Sound } from "../../sound.js";
import { useTheme } from "../../theme-context.jsx";
import { primaryBtn } from "../../styles.js";
import { PuzzlePanel } from "../../components/PuzzlePanel.jsx";
import { ResultCarousel } from "../../components/ResultCarousel.jsx";
import { ScorePips } from "../../components/mp/ScorePips.jsx";
import { MpFrame } from "./MpFrame.jsx";

// The "Computer" card: the best line the exhaustive solver can find for the
// authoritative puzzle, computed on-device (the numbers and target are known).
// If the backend ever ships its own algorithm solution, that takes precedence.
function computerSolution(result) {
  if (result.algorithmSolution) return result.algorithmSolution;
  const { numbers, target } = result;
  if (!Array.isArray(numbers) || typeof target !== "number") return null;
  const sol = solve(numbers, target);
  const nearest = numbers.reduce(
    (best, n) => (Math.abs(n - target) < Math.abs(best - target) ? n : best),
    numbers[0]
  );
  const value = sol.steps.length ? sol.steps[sol.steps.length - 1].result : sol.exact ? target : nearest;
  return { value, distance: sol.diff, exact: sol.exact, operations: sol.steps.length, steps: sol.steps };
}

// The round is decided by the backend; this reveals the answers as a swipeable
// carousel (you first, then the algorithm if the backend ever supplies one,
// then opponents) and offers to continue. Continuing re-arms readiness — the
// backend starts the next round once everyone is ready again.
export function RoundResults({ result, room, match, playerId, connectionState, onReadyNext, onLeave }) {
  const T = useTheme();
  const players = room.players || [];
  const me = players.find((p) => p.playerId === playerId);
  const iAmReady = !!me?.ready;
  const enriched = { ...result, algorithmSolution: computerSolution(result) };
  const cards = orderResultCards(enriched, playerId, players);

  const iWon = result.winnerId === playerId;
  const winnerName = result.isTie ? null : iWon ? "You" : players.find((p) => p.playerId === result.winnerId)?.displayName || "Opponent";

  // A short outcome cue, once, when the result lands.
  useEffect(() => {
    if (result.isTie) Sound.nearMiss?.();
    else if (iWon) Sound.success?.();
    else Sound.fail?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.roundNumber]);

  const ready = () => {
    Sound.init?.();
    onReadyNext();
  };

  return (
    <MpFrame title={`Round ${result.roundNumber}`} connectionState={connectionState} onLeave={onLeave}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.sans, fontSize: 20, fontWeight: 700, color: result.isTie ? T.violet : T.gold }}>
          {result.isTie ? "Round tied" : `${winnerName} won the round`}
        </div>
      </div>

      <PuzzlePanel target={result.target} numbers={result.numbers} perfect={iWon && cards[0]?.exact} />

      <ResultCarousel cards={cards} target={result.target} resetKey={result.roundNumber} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {players.map((p) => (
          <ScorePips
            key={p.playerId}
            name={p.playerId === playerId ? "You" : p.displayName}
            wins={(result.scores || {})[p.playerId] || 0}
            needed={match?.winsNeeded ?? 3}
            highlight={p.playerId === playerId}
          />
        ))}
      </div>

      {iAmReady ? (
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: 14, color: T.cyan, margin: 0 }}>
          Ready — waiting for your opponent…
        </p>
      ) : (
        <button onClick={ready} style={{ ...primaryBtn(T), width: "100%" }}>
          Next round
        </button>
      )}
    </MpFrame>
  );
}
