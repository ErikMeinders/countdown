// ── Result-card ordering ───────────────────────────────────────
// Turns a backend `roundResult` into the ordered list of cards the reveal
// carousel shows: humans first (the local player, then opponents), and the
// computer's solution last. Each human's submitted expression is parsed back
// into color-coded steps so every card reads the same long style. Pure, so the
// ordering is unit-tested.

import { expressionToSteps } from "../shared/expressionSteps.js";

export function orderResultCards(result, currentPlayerId, players) {
  if (!result) return [];
  const nameOf = (id) => players.find((p) => p.playerId === id)?.displayName || "Player";
  const byPlayer = new Map((result.submissions || []).map((s) => [s.playerId, s]));

  const humanCard = (id, isYou) => {
    const sub = byPlayer.get(id);
    const parsed = sub ? expressionToSteps(sub.expression) : null;
    return {
      key: `player-${id}`,
      kind: "human",
      playerId: id,
      name: isYou ? "You" : nameOf(id),
      submitted: !!sub,
      steps: parsed ? parsed.steps : null,
      expression: sub?.expression ?? null,
      value: sub?.value ?? null,
      distance: sub?.distance ?? null,
      exact: sub?.exact ?? false,
      operations: sub?.operations ?? null,
      isWinner: result.winnerId === id,
    };
  };

  const cards = [];

  // 1. Humans — the local player first, then the rest of the roster.
  if (currentPlayerId) cards.push(humanCard(currentPlayerId, true));
  for (const p of players) {
    if (p.playerId !== currentPlayerId) cards.push(humanCard(p.playerId, false));
  }
  // Any submitter not in the roster (defensive), preserving order.
  for (const s of result.submissions || []) {
    if (s.playerId !== currentPlayerId && !players.some((p) => p.playerId === s.playerId)) {
      cards.push(humanCard(s.playerId, false));
    }
  }

  // 2. The computer's solution last, if one was supplied.
  if (result.algorithmSolution) {
    const algo = result.algorithmSolution;
    cards.push({
      key: "computer",
      kind: "computer",
      name: "Computer",
      submitted: true,
      steps: algo.steps ?? null,
      value: algo.value ?? null,
      distance: algo.distance ?? null,
      exact: algo.exact ?? false,
      operations: algo.operations ?? null,
      isWinner: false,
    });
  }

  return cards;
}
