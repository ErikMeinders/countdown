import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ACTIONS,
  humanError,
  messages,
  normalizeRoomCode,
  parseServerMessage,
} from "../../src/services/protocol.js";
import { joinUrl, parseJoinCode } from "../../src/routing.js";
import { RoundPhase, roundTiming, totalSeconds } from "../../src/game/shared/timing.js";
import { orderResultCards } from "../../src/game/multiplayer/results.js";
import {
  initCalculator,
  selectNumber,
  selectOperator,
  resetWorking,
} from "../../src/game/shared/calculator.js";
import { bestAnswer, expressionForIntermediate } from "../../src/game/shared/expression.js";

describe("room code normalization", () => {
  it("trims, uppercases and strips invalid characters", () => {
    expect(normalizeRoomCode("  ab7d ")).toEqual({ code: "AB7D", valid: true });
    expect(normalizeRoomCode("a-b7d")).toEqual({ code: "AB7D", valid: true });
  });

  it("rejects the ambiguous letters and wrong lengths", () => {
    expect(normalizeRoomCode("O0I1").valid).toBe(false); // all stripped
    expect(normalizeRoomCode("AB7").valid).toBe(false); // too short
    expect(normalizeRoomCode("ABCDE").valid).toBe(false); // too long
  });
});

describe("protocol", () => {
  it("builds messages with the exact backend action names", () => {
    expect(messages.createRoom("Erik").action).toBe(ACTIONS.CREATE_ROOM);
    expect(messages.joinRoom("ABCD", "Erik").action).toBe("joinRoom");
    expect(messages.submitAnswer("ABCD", "p", 1, "1+2", 3).payload).toMatchObject({
      roomCode: "ABCD",
      roundNumber: 1,
      expression: "1+2",
    });
    expect(messages.createRoom("Erik").requestId).toBeTruthy();
  });

  it("maps error codes to human messages, with a fallback", () => {
    expect(humanError("ROOM_NOT_FOUND")).toMatch(/doesn't exist/i);
    expect(humanError("SOMETHING_NEW", "raw")).toBe("raw");
  });

  it("parses valid frames and rejects malformed ones", () => {
    expect(parseServerMessage('{"type":"pong","payload":{}}')).toMatchObject({ type: "pong" });
    expect(parseServerMessage("not json")).toBeNull();
    expect(parseServerMessage('{"no":"type"}')).toBeNull();
  });
});

describe("deep-link routing", () => {
  it("builds a hash join URL (never the wss URL)", () => {
    const url = joinUrl("AB7D");
    expect(url).toMatch(/#\/join\/AB7D$/);
    expect(url).not.toMatch(/^wss:/);
  });

  it("parses a join code from hash, query and path", () => {
    expect(parseJoinCode({ hash: "#/join/ab7d", search: "", pathname: "/" })).toBe("AB7D");
    expect(parseJoinCode({ hash: "", search: "?join=ab7d", pathname: "/" })).toBe("AB7D");
    expect(parseJoinCode({ hash: "", search: "", pathname: "/countdown/join/AB7D" })).toBe("AB7D");
  });

  it("returns null for an invalid or absent code", () => {
    expect(parseJoinCode({ hash: "#/join/xx", search: "", pathname: "/" })).toBeNull();
    expect(parseJoinCode({ hash: "", search: "", pathname: "/" })).toBeNull();
  });
});

describe("round timing is driven by server timestamps", () => {
  const round = { startsAt: 1000, endsAt: 46000, revealAt: 49000 };

  it("computes total seconds from the window", () => {
    expect(totalSeconds(round)).toBe(45);
  });

  it("reveals before startsAt, solves until endsAt, then ends", () => {
    expect(roundTiming(round, 500).phase).toBe(RoundPhase.REVEAL);
    const solving = roundTiming(round, 1000 + 5000);
    expect(solving.phase).toBe(RoundPhase.SOLVING);
    expect(solving.secondsLeft).toBe(40); // (46000 - 6000) / 1000
    expect(roundTiming(round, 46000).phase).toBe(RoundPhase.ENDED);
  });
});

describe("result-card ordering", () => {
  const players = [
    { playerId: "you", displayName: "Erik" },
    { playerId: "opp", displayName: "Alice" },
  ];
  const result = {
    target: 521,
    winnerId: "you",
    submissions: [
      { playerId: "opp", expression: "1", value: 1, distance: 520, operations: 0, exact: false },
      { playerId: "you", expression: "521", value: 521, distance: 0, operations: 0, exact: true },
    ],
  };

  it("puts the local player first, opponents after, marking the winner", () => {
    const cards = orderResultCards(result, "you", players);
    expect(cards.map((c) => c.name)).toEqual(["You", "Alice"]);
    expect(cards[0].isWinner).toBe(true);
    expect(cards[0].exact).toBe(true);
  });

  it("parses a human's expression back into color-coded steps", () => {
    const withExpr = {
      ...result,
      submissions: [{ playerId: "you", expression: "(4 + 5) * 2", value: 18, distance: 503, operations: 2, exact: false }],
    };
    const you = orderResultCards(withExpr, "you", players)[0];
    expect(you.steps).toEqual([
      { a: 4, op: "+", b: 5, result: 9 },
      { a: 9, op: "×", b: 2, result: 18 },
    ]);
  });

  it("puts the computer card last, and omits it unless supplied", () => {
    expect(orderResultCards(result, "you", players).some((c) => c.kind === "computer")).toBe(false);
    const withAlgo = { ...result, algorithmSolution: { value: 521, exact: true, steps: [] } };
    const cards = orderResultCards(withAlgo, "you", players);
    expect(cards[cards.length - 1].kind).toBe("computer");
    expect(cards[cards.length - 1].name).toBe("Computer");
  });

  it("still shows a card for a player who didn't submit", () => {
    const noOpp = { ...result, submissions: [result.submissions[1]] };
    const cards = orderResultCards(noOpp, "you", players);
    expect(cards.find((c) => c.name === "Alice").submitted).toBe(false);
  });
});

describe("shared calculator and expression serialization", () => {
  const numbers = [75, 50, 2, 3, 8, 7];

  it("builds an intermediate and rejects an illegal (negative) step", () => {
    let s = initCalculator(numbers, 521);
    s = selectNumber(s, 75, "number", 0);
    s = selectOperator(s, "+");
    s = selectNumber(s, 50, "number", 1);
    expect(s.intermediates[0].value).toBe(125);

    // 2 − 8 would be negative: the step is refused, selection cleared.
    let bad = initCalculator(numbers, 521);
    bad = selectNumber(bad, 2, "number", 2);
    bad = selectOperator(bad, "−");
    bad = selectNumber(bad, 8, "number", 4);
    expect(bad.intermediates).toHaveLength(0);
    expect(bad.currentA).toBeNull();
  });

  it("serializes a step tree to an ASCII infix expression with an op count", () => {
    let s = initCalculator(numbers, 521);
    s = selectNumber(s, 75, "number", 0);
    s = selectOperator(s, "×");
    s = selectNumber(s, 7, "number", 5); // 75 × 7 = 525
    expect(expressionForIntermediate(s, 0)).toBe("75 * 7");

    const best = bestAnswer(s);
    expect(best.value).toBe(525);
    expect(best.distance).toBe(4); // |525 - 521|
    expect(best.operations).toBe(1);
    expect(best.expression).toBe("75 * 7");
  });

  it("reset clears the working back to the tiles", () => {
    let s = initCalculator(numbers, 521);
    s = selectNumber(s, 75, "number", 0);
    s = selectOperator(s, "+");
    s = selectNumber(s, 50, "number", 1);
    s = resetWorking(s);
    expect(s.intermediates).toHaveLength(0);
    expect(s.usedIndices.size).toBe(0);
  });
});

afterEach(() => vi.restoreAllMocks());
