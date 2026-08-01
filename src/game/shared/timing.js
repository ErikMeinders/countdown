// ── Round timing ───────────────────────────────────────────────
// The round's clock is driven by the server's wall-clock timestamps, not by a
// chain of local setTimeouts — so two phones stay in step even if one rendered
// the round a moment later. Everything is computed from `Date.now()` against
// the authoritative `startsAt` / `endsAt` the backend sent.

export const RoundPhase = Object.freeze({
  REVEAL: "reveal", // numbers spinning in; clock not started
  SOLVING: "solving", // clock running
  ENDED: "ended", // deadline passed
});

export function totalSeconds(round) {
  return Math.max(0, Math.round((round.endsAt - round.startsAt) / 1000));
}

// Current phase and the seconds remaining, from now.
export function roundTiming(round, now = Date.now()) {
  if (!round) return { phase: RoundPhase.ENDED, secondsLeft: 0, total: 0 };
  const total = totalSeconds(round);
  if (now < round.startsAt) {
    return { phase: RoundPhase.REVEAL, secondsLeft: total, total };
  }
  if (now < round.endsAt) {
    return {
      phase: RoundPhase.SOLVING,
      secondsLeft: Math.max(0, Math.ceil((round.endsAt - now) / 1000)),
      total,
    };
  }
  return { phase: RoundPhase.ENDED, secondsLeft: 0, total };
}

// Whether the reveal window is still ahead of us — clients that join a round
// slightly late will already be past it and should skip the spin.
export function shouldReveal(round, now = Date.now()) {
  return !!round && now < round.startsAt;
}
