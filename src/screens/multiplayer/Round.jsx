import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { OPERATORS } from "../../game/rules.js";
import {
  clearSelection,
  initCalculator,
  lastCalcIndex,
  resetWorking,
  selectNumber,
  selectOperator,
  undoIntermediate,
} from "../../game/shared/calculator.js";
import { bestAnswer } from "../../game/shared/expression.js";
import { totalSeconds } from "../../game/shared/timing.js";
import { REDUCED, REEL_START_MS, TILE_COUNT, TILE_DEAL_MS } from "../../constants.js";
import { Sound } from "../../sound.js";
import { SubmissionState } from "../../state/multiplayerMachine.js";
import { useTheme } from "../../theme-context.jsx";
import { filledRowBtn, secondaryBtn, tertiaryBtn } from "../../styles.js";
import { NumberTile } from "../../components/NumberTile.jsx";
import { OpButton } from "../../components/OpButton.jsx";
import { StepList } from "../../components/StepList.jsx";
import { TargetPanel } from "../../components/TargetPanel.jsx";
import { ScorePips } from "../../components/mp/ScorePips.jsx";
import { MpFrame } from "./MpFrame.jsx";

const SUBMISSION_LABEL = {
  [SubmissionState.IDLE]: "Not submitted",
  [SubmissionState.SUBMITTING]: "Submitting…",
  [SubmissionState.ACCEPTED]: "Accepted",
  [SubmissionState.IMPROVED]: "Improved answer accepted",
  [SubmissionState.REJECTED]: "Rejected",
};

// The multiplayer solving screen. The authoritative puzzle and clock come from
// the server; the reveal animates toward the already-known numbers and target,
// and the timer is computed from `endsAt`, never from chained timeouts.
export function Round({ room, match, playerId, round, submission, connectionState, onSubmit, onDeadline, onLeave }) {
  const T = useTheme();
  const [calc, setCalc] = useState(() => initCalculator(round.numbers, round.target));
  const [revealing, setRevealing] = useState(!REDUCED);
  const [now, setNow] = useState(() => Date.now());
  const clockStart = useRef(REDUCED ? Date.now() : null);
  const deadlineFired = useRef(false);
  const lastTick = useRef(null);

  // Rebuild the board and restart the reveal when a new round arrives, and play
  // the deal + reel cues. The reveal is driven *locally* — a fixed-length spin
  // ended by the reels settling — so the wheels always spin and stay in step
  // with their audio, regardless of clock skew between devices. The clock then
  // runs for the server-defined duration, started when the reveal ends.
  useEffect(() => {
    setCalc(initCalculator(round.numbers, round.target));
    setRevealing(!REDUCED);
    clockStart.current = REDUCED ? Date.now() : null;
    deadlineFired.current = false;
    lastTick.current = null;
    if (REDUCED) return undefined;
    const timers = [];
    for (let i = 0; i < TILE_COUNT; i++) timers.push(setTimeout(Sound.tileDrop, i * TILE_DEAL_MS));
    timers.push(setTimeout(Sound.reels, REEL_START_MS));
    return () => timers.forEach(clearTimeout);
  }, [round.roundNumber]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const onRevealed = useCallback(() => {
    setRevealing(false);
    if (clockStart.current == null) clockStart.current = Date.now();
  }, []);

  const duration = totalSeconds(round);
  const started = clockStart.current != null;
  const elapsed = started ? Math.floor((now - clockStart.current) / 1000) : 0;
  const secondsLeft = Math.max(0, duration - elapsed);
  // The server deadline is the real cutoff; respect it too (with a little grace)
  // so a client whose clock runs slow can't keep playing past the round.
  const serverPastDeadline = now > round.endsAt + 1000;
  const ended = started && !revealing && (secondsLeft <= 0 || serverPastDeadline);
  const solving = started && !revealing && !ended;

  const best = useMemo(() => bestAnswer(calc), [calc]);

  // A tick each second while the clock runs.
  useEffect(() => {
    if (solving && secondsLeft !== lastTick.current) {
      lastTick.current = secondsLeft;
      Sound.tick?.(secondsLeft);
    }
  }, [solving, secondsLeft]);

  // When the round ends, submit the best answer once and let the parent move on.
  useEffect(() => {
    if (ended && !deadlineFired.current) {
      deadlineFired.current = true;
      Sound.timeUp?.();
      onDeadline(best);
    }
  }, [ended, best, onDeadline]);

  const idx = lastCalcIndex(calc);
  const submissionState = submission.state;
  const canSubmit = solving && best !== null && submissionState !== SubmissionState.SUBMITTING;

  const tap = (fn) => solving && setCalc(fn);

  return (
    <MpFrame title={`Round ${round.roundNumber} of ${match?.bestOf ?? 5}`} connectionState={connectionState} onLeave={onLeave}>
      {/* Compact score status */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(room.players || []).map((p) => (
          <ScorePips
            key={p.playerId}
            name={p.playerId === playerId ? "You" : p.displayName}
            wins={(room.scores || {})[p.playerId] || 0}
            needed={match?.winsNeeded ?? 3}
            highlight={p.playerId === playerId}
          />
        ))}
      </div>

      <TargetPanel
        target={round.target}
        seconds={secondsLeft}
        total={duration}
        running={solving}
        finished={ended}
        perfect={best?.exact}
        revealing={revealing}
        roundId={round.roundNumber}
        onRevealed={onRevealed}
      />

      {/* Tiles */}
      <div style={{ display: "flex", gap: T.gap.sm, flexWrap: "wrap", justifyContent: "center", minHeight: 58 }}>
        {calc.numbers.map((n, i) =>
          calc.usedIndices.has(i) ? null : (
            <div
              key={`n-${i}`}
              style={{
                // Deal the tiles one at a time during the reveal, on the same
                // cadence as the drop sounds; afterwards they appear instantly.
                animation: REDUCED || !revealing ? "none" : "popIn 0.34s cubic-bezier(.34,1.4,.5,1) both",
                animationDelay: revealing && calc.steps.filter(Boolean).length === 0 ? `${i * TILE_DEAL_MS}ms` : "0ms",
              }}
            >
              <NumberTile
                value={n}
                selected={calc.currentA?.sourceType === "number" && calc.currentA?.sourceIndex === i}
                onClick={() => tap((s) => selectNumber(s, n, "number", i))}
              />
            </div>
          )
        )}
        {calc.intermediates.map((im, i) =>
          !im || calc.usedIntermediates.has(i) ? null : (
            <NumberTile
              key={`i-${i}`}
              value={im.value}
              calculated
              selected={calc.currentA?.sourceType === "intermediate" && calc.currentA?.sourceIndex === i}
              onClick={() => tap((s) => selectNumber(s, im.value, "intermediate", i))}
              onDoubleClick={() => tap((s) => undoIntermediate(s, i))}
            />
          )
        )}
      </div>

      {/* Operator pad */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 56px)", gridTemplateRows: "repeat(2, 56px)", gap: T.gap.sm }}>
          {OPERATORS.map((op) => (
            <OpButton
              key={op}
              op={op}
              active={calc.currentOp === op}
              enabled={solving && (calc.currentA !== null || idx >= 0)}
              onClick={() => tap((s) => selectOperator(s, op))}
            />
          ))}
        </div>
      </div>

      {/* Live local preview — clearly provisional until the backend confirms */}
      <div style={{ textAlign: "center", fontFamily: T.mono, fontSize: T.type.sm, color: T.mutedLight, minHeight: 20 }}>
        {best ? (
          <>
            Best so far <span style={{ color: best.exact ? T.gold : T.cyan, fontWeight: 700 }}>{best.value}</span>{" "}
            <span style={{ color: T.muted }}>({best.exact ? "exact" : `${best.distance} off`})</span>
          </>
        ) : (
          "Tap a number, then an operator."
        )}
      </div>

      {calc.steps.filter(Boolean).length > 0 && <StepList steps={calc.steps.filter(Boolean)} label="Working" />}

      {/* Submission status */}
      <div
        role="status"
        aria-live="polite"
        style={{
          textAlign: "center",
          fontFamily: T.sans,
          fontSize: T.type.sm,
          fontWeight: 600,
          color:
            submissionState === SubmissionState.REJECTED
              ? T.red
              : submissionState === SubmissionState.ACCEPTED || submissionState === SubmissionState.IMPROVED
                ? T.cyan
                : T.muted,
          minHeight: 18,
        }}
      >
        {SUBMISSION_LABEL[submissionState]}
        {submission.error ? ` — ${submission.error}` : ""}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: T.gap.sm }}>
        <button
          onClick={() => tap((s) => clearSelection(s))}
          disabled={!solving || (calc.currentA === null && calc.currentOp === null)}
          style={{ ...tertiaryBtn(T), opacity: solving && (calc.currentA || calc.currentOp) ? 1 : 0.4 }}
        >
          Cancel
        </button>
        <button onClick={() => tap((s) => resetWorking(s))} disabled={!solving} style={secondaryBtn(T)}>
          Reset
        </button>
        <button
          onClick={() => canSubmit && onSubmit(best.expression, best.value)}
          disabled={!canSubmit}
          style={{ ...filledRowBtn(T), opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
        >
          {submissionState === SubmissionState.IDLE ? "Submit" : "Resubmit"}
        </button>
      </div>

      {ended && (
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: 14, color: T.mutedLight, margin: 0 }}>
          Time! Waiting for the result…
        </p>
      )}
    </MpFrame>
  );
}
