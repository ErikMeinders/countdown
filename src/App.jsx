import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTheme } from "./theme-context.jsx";
import { filledRowBtn, primaryBtn, secondaryBtn, tertiaryBtn } from "./styles.js";
import {
  PHASES, PHASE_ORDER, REDUCED, REEL_START_MS, SWAP_MS, TILE_COUNT, TILE_DEAL_MS,
} from "./constants.js";
import {
  OPERATORS, ROUND_LENGTHS,
  evaluate, generateNumbers, generateSolvableTarget, generateTarget,
} from "./game/rules.js";
import { solve } from "./game/solver.js";
import { traceTiles } from "./game/trace.js";
import { Sound } from "./sound.js";
import { HelpOverlay } from "./components/HelpOverlay.jsx";
import { NumberTile } from "./components/NumberTile.jsx";
import { OpButton } from "./components/OpButton.jsx";
import { StepList } from "./components/StepList.jsx";
import { TargetPanel } from "./components/TargetPanel.jsx";
import { PuzzlePanel } from "./components/PuzzlePanel.jsx";
import { ResultCarousel } from "./components/ResultCarousel.jsx";
import { SoundToggle } from "./components/SoundToggle.jsx";
import { ThemeToggle } from "./components/ThemeToggle.jsx";
import { PersonIcon } from "./components/mp/PersonIcon.jsx";

// Rounds: a single-player session is this many scored rounds; a together match
// is best-of this many.
const ROUND_CHOICES = [3, 5, 7];

// One control language for the whole setup screen: a labelled row of pills.
// Everything — large numbers, target, length, rounds — is the same shape and
// type size, so the screen reads as one system rather than a stack of panels.
function Setting({ label, children }) {
  const T = useTheme();
  return (
    <div>
      <div style={{
        fontSize: 10, letterSpacing: 2, textTransform: "uppercase",
        color: T.muted, fontFamily: T.mono, marginBottom: 8, textAlign: "center",
      }}>{label}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function Pill({ on, onClick, children }) {
  const T = useTheme();
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        flex: 1, height: 46, padding: "0 8px",
        borderRadius: T.r.md,
        border: `1.5px solid ${on ? T.cyan : T.hair}`,
        background: on ? T.cyanDim : "transparent",
        color: on ? T.cyan : T.mutedLight,
        fontFamily: T.sans, fontSize: 15, fontWeight: on ? 700 : 500,
        cursor: "pointer", transition: "all 0.15s",
      }}
    >{children}</button>
  );
}

// ── Main Game ──────────────────────────────────────────────────
// The single-player game, and the shared parameters screen. Choosing "Together"
// hands the chosen time and rounds up to the shell, which switches to the
// multiplayer flow; nothing here opens a socket.
export default function CountdownGame({ onTogether, multiplayerAvailable = false, multiWarning = "" } = {}) {
  const T = useTheme();
  const [phase, setPhase] = useState(PHASES.PICK);
  const [displayPhase, setDisplayPhase] = useState(PHASES.PICK);
  const [anim, setAnim] = useState("in");        // "in" | "out"
  const [dir, setDir] = useState("fwd");         // "fwd" | "back"
  const [armed, setArmed] = useState(false);     // start clock once play screen has landed
  const [revealing, setRevealing] = useState(false);
  const [roundId, setRoundId] = useState(0);
  const [numLarge, setNumLarge] = useState(2);
  const [numbers, setNumbers] = useState([]);
  const [target, setTarget] = useState(0);
  const [muted, setMuted] = useState(false);

  const [seconds, setSeconds] = useState(30);
  const [roundLength, setRoundLength] = useState(45);
  const [timeChoice, setTimeChoice] = useState(45); // selected on the pick screen
  const [rounds, setRounds] = useState(5); // session length (single) / best-of (together)
  const [roundNo, setRoundNo] = useState(1); // current round within a single-player session
  const [totalPts, setTotalPts] = useState(0); // running points across the session
  const [solvableOnly, setSolvableOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);
  const scoredRound = useRef(0); // guards the once-per-round points tally

  const [usedIndices, setUsedIndices] = useState(new Set());
  const [steps, setSteps] = useState([]);
  const [currentA, setCurrentA] = useState(null);
  const [currentOp, setCurrentOp] = useState(null);
  const [intermediates, setIntermediates] = useState([]);
  const [usedIntermediates, setUsedIntermediates] = useState(new Set());

  const [solution, setSolution] = useState(null);
  const [solving, setSolving] = useState(false);
  const [bestResult, setBestResult] = useState(null);
  const [answerTiles, setAnswerTiles] = useState(new Set());

  // Drive the out → swap → in sequence whenever the phase changes
  useEffect(() => {
    if (phase === displayPhase) return;
    setDir(PHASE_ORDER[phase] > PHASE_ORDER[displayPhase] ? "fwd" : "back");
    setAnim("out");
    const id = setTimeout(() => {
      setDisplayPhase(phase);
      setAnim("in");
    }, SWAP_MS);
    return () => clearTimeout(id);
  }, [phase, displayPhase]);

  // Once the playground has landed, spin the reels. The clock is held back
  // until they settle, so you always get the full round.
  useEffect(() => {
    if (armed && anim === "in" && displayPhase === PHASES.PLAY) {
      setArmed(false);
      if (REDUCED) { setRunning(true); return; }
      setRevealing(true);

      // The tiles used to appear in silence and the reels opened with one
      // loud hit. Now each tile lands on its own click and the reels follow.
      //
      // Deliberately not cleaned up: setArmed(false) above re-runs this
      // effect, so a cleanup would cancel every timer the moment it was
      // scheduled and the deal would be silent again. They are one-shot
      // sound cues with no state to leak, and the guard above stops them
      // being scheduled twice.
      for (let i = 0; i < TILE_COUNT; i++) setTimeout(Sound.tileDrop, i * TILE_DEAL_MS);
      setTimeout(Sound.reels, REEL_START_MS);
    }
  }, [armed, anim, displayPhase]);

  const handleRevealed = useCallback(() => {
    setRevealing(false);
    setRunning(true);
  }, []);

  // Work out the optimal line as soon as the round ends
  useEffect(() => {
    if (phase !== PHASES.RESULT || solution || !numbers.length) return;
    setSolving(true);
    const id = setTimeout(() => {
      setSolution(solve(numbers, target));
      setSolving(false);
    }, 30);
    return () => clearTimeout(id);
  }, [phase, solution, numbers, target]);

  const endRound = useCallback(() => {
    setRunning(false);
    // Every step result is also an intermediate, so scanning intermediates
    // plus untouched originals covers every value the player produced.
    let closest = null, closestDiff = Infinity, source = null;
    intermediates.forEach((im, i) => {
      if (!im) return;
      const d = Math.abs(im.value - target);
      if (d < closestDiff) {
        closestDiff = d; closest = im.value; source = { type: "intermediate", index: i };
      }
    });
    numbers.forEach((n, i) => {
      if (!usedIndices.has(i)) {
        const d = Math.abs(n - target);
        if (d < closestDiff) {
          closestDiff = d; closest = n; source = { type: "number", index: i };
        }
      }
    });
    setBestResult(closest);
    setAnswerTiles(traceTiles(intermediates, source));
    if (closestDiff === 0) Sound.success();
    else if (closestDiff <= 10) Sound.nearMiss();
    else Sound.fail();
    setPhase(PHASES.RESULT);
  }, [steps, intermediates, numbers, usedIndices, target]);

  useEffect(() => {
    if (running && seconds > 0) {
      Sound.tick(seconds);
      timerRef.current = setTimeout(() => setSeconds(s => s - 1), 1000);
    } else if (running && seconds === 0) {
      Sound.timeUp();
      setRunning(false);
      endRound();
    }
    return () => clearTimeout(timerRef.current);
  }, [running, seconds]);

  async function startGame(length) {
    await Sound.init();
    const nums = generateNumbers(numLarge);
    setNumbers(nums);
    setTarget(solvableOnly ? generateSolvableTarget(nums) : generateTarget());
    setRoundLength(length);
    setSeconds(length);
    setArmed(true);
    setRunning(false);
    setRevealing(false);
    setRoundId(r => r + 1);
    setUsedIndices(new Set());
    setSteps([]);
    setCurrentA(null);
    setCurrentOp(null);
    setIntermediates([]);
    setUsedIntermediates(new Set());
    setSolution(null);
    setSolving(false);
    setBestResult(null);
    setAnswerTiles(new Set());
    setPhase(PHASES.PLAY);
  }

  function selectNumber(value, sourceType, sourceIndex) {
    if (!running) return;
    if (currentA === null) {
      Sound.click(sourceType === "intermediate");
      setCurrentA({ value, sourceType, sourceIndex });
      return;
    }
    // Tapping the selected tile again deselects it
    if (currentA.sourceType === sourceType && currentA.sourceIndex === sourceIndex) {
      setCurrentA(null);
      setCurrentOp(null);
      return;
    }
    if (!currentOp) {
      Sound.click(sourceType === "intermediate");
      setCurrentA({ value, sourceType, sourceIndex });
      return;
    }

    const result = evaluate(currentA.value, currentOp, value);
    if (result === null || result <= 0 || !Number.isInteger(result)) {
      setCurrentA(null);
      setCurrentOp(null);
      return;
    }
    Sound.click(sourceType === "intermediate");

    const newUsed = new Set(usedIndices);
    if (currentA.sourceType === "number") newUsed.add(currentA.sourceIndex);
    if (sourceType === "number") newUsed.add(sourceIndex);

    const newUsedInt = new Set(usedIntermediates);
    if (currentA.sourceType === "intermediate") newUsedInt.add(currentA.sourceIndex);
    if (sourceType === "intermediate") newUsedInt.add(sourceIndex);

    setUsedIndices(newUsed);
    setUsedIntermediates(newUsedInt);

    const sources = [
      { type: currentA.sourceType, index: currentA.sourceIndex },
      { type: sourceType, index: sourceIndex },
    ];
    const nextIntermediates = [...intermediates, { value: result, sources }];
    setSteps(prev => [...prev, { a: currentA.value, op: currentOp, b: value, result }]);
    setIntermediates(nextIntermediates);
    setCurrentA(null);
    setCurrentOp(null);

    Sound.calcDone(result === target);
    if (result === target) {
      setRunning(false);
      setBestResult(result);
      setAnswerTiles(traceTiles(nextIntermediates, {
        type: "intermediate", index: nextIntermediates.length - 1,
      }));
      setTimeout(() => setPhase(PHASES.RESULT), 900);
    }
  }

  // The most recent calculated tile still sitting on the board. Tapping an
  // operator with nothing selected chains from this.
  const lastCalcIndex = useMemo(() => {
    for (let i = intermediates.length - 1; i >= 0; i--) {
      if (intermediates[i] && !usedIntermediates.has(i)) return i;
    }
    return -1;
  }, [intermediates, usedIntermediates]);

  function handleOperator(op) {
    if (!running) return;

    // A number is already picked — this just sets the operator, as before.
    if (currentA !== null) {
      Sound.operatorClick();
      setCurrentOp(op);
      return;
    }

    // Nothing picked, but a calculated tile exists: imply it as the left
    // operand so you can carry on from your last result. Note this only
    // fires on an operator tap — tapping a number first still starts a
    // completely fresh sum.
    if (lastCalcIndex >= 0) {
      Sound.operatorClick();
      setCurrentA({
        value: intermediates[lastCalcIndex].value,
        sourceType: "intermediate",
        sourceIndex: lastCalcIndex,
        implied: true,
      });
      setCurrentOp(op);
    }
  }

  function undoIntermediate(intIndex) {
    if (!running) return;
    const im = intermediates[intIndex];
    if (!im || usedIntermediates.has(intIndex)) return;
    Sound.undo();

    const newUsed = new Set(usedIndices);
    const newUsedInt = new Set(usedIntermediates);
    for (const src of im.sources) {
      if (src.type === "number") newUsed.delete(src.index);
      if (src.type === "intermediate") newUsedInt.delete(src.index);
    }
    setUsedIndices(newUsed);
    setUsedIntermediates(newUsedInt);
    setIntermediates(prev => { const n = [...prev]; n[intIndex] = null; return n; });
    setSteps(prev => { const n = [...prev]; n[intIndex] = null; return n; });

    if (currentA?.sourceType === "intermediate" && currentA?.sourceIndex === intIndex) {
      setCurrentA(null);
      setCurrentOp(null);
    }
  }

  function resetAll() {
    setSteps([]);
    setUsedIndices(new Set());
    setIntermediates([]);
    setUsedIntermediates(new Set());
    setCurrentA(null);
    setCurrentOp(null);
  }

  function newGame() {
    setPhase(PHASES.PICK);
    setSolution(null);
    setSolving(false);
  }

  // A single-player session: play `rounds` rounds, keeping a running points
  // total (10 exact, 7 within five, 5 within ten, else 0).
  async function startSession(length) {
    setRoundNo(1);
    setTotalPts(0);
    scoredRound.current = 0;
    await startGame(length);
  }
  function nextRound() {
    setRoundNo((r) => r + 1);
    startGame(roundLength);
  }
  function playAgain() {
    startSession(roundLength);
  }
  const sessionComplete = roundNo >= rounds;

  const score = (() => {
    if (bestResult === null) return 0;
    const diff = Math.abs(bestResult - target);
    if (diff === 0) return 10;
    if (diff <= 5) return 7;
    if (diff <= 10) return 5;
    return 0;
  })();
  const perfect = score === 10;
  const liveSteps = steps.filter(Boolean);

  // The two solution cards for the result carousel: yours, then the computer's.
  const solverValue = solution
    ? solution.steps.length
      ? solution.steps[solution.steps.length - 1].result
      : solution.exact
        ? target
        : numbers.reduce((b, n) => (Math.abs(n - target) < Math.abs(b - target) ? n : b), numbers[0] ?? 0)
    : null;
  const resultCards = [
    {
      key: "you", kind: "human", name: "You", submitted: bestResult !== null,
      steps: liveSteps, value: bestResult,
      distance: bestResult !== null ? Math.abs(bestResult - target) : null,
      exact: perfect, operations: liveSteps.length, isWinner: false,
    },
    {
      key: "computer", kind: "computer", name: "Computer", submitted: !!solution,
      steps: solution ? solution.steps : [], value: solverValue,
      distance: solution ? solution.diff : null, exact: solution ? solution.exact : false,
      operations: solution ? solution.steps.length : 0, isWinner: false,
    },
  ];

  // Tally this round's points into the session total, exactly once per round.
  useEffect(() => {
    if (phase === PHASES.RESULT && scoredRound.current !== roundId) {
      scoredRound.current = roundId;
      setTotalPts((t) => t + score);
    }
  }, [phase, roundId, score]);

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(140% 100% at 50% -10%, ${T.bgLow} 0%, ${T.bgMid} 45%, ${T.bg} 100%)`,
      color: T.text, fontFamily: T.sans,
      padding: "16px 12px 24px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Header — title centered, a toggle in each corner on its baseline */}
      <div style={{
        position: "relative", width: "100%", maxWidth: 420,
        height: 44, marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <h1 style={{
          fontFamily: T.sans, fontSize: 26, fontWeight: 700, letterSpacing: 7, margin: 0,
          color: T.text, opacity: 0.92,
        }}>COUNTDOWN</h1>
        <ThemeToggle />
        <SoundToggle
          muted={muted}
          onToggle={() => { const n = !muted; setMuted(n); Sound.setMuted(n); }}
        />
      </div>

      {/* Animated phase container */}
      <div
        style={{
          width: "100%", maxWidth: 420,
          display: "flex", flexDirection: "column", alignItems: "center",
          animation: SWAP_MS
            ? `phase${anim === "out" ? "Exit" : "Enter"}${dir === "fwd" ? "Fwd" : "Back"} ${SWAP_MS}ms cubic-bezier(.4,0,.2,1) both`
            : "none",
          willChange: "opacity, transform",
        }}
      >

      {/* ── PICK ────────────────────────────────────────────── */}
      {displayPhase === PHASES.PICK && (
        <div style={{
          display: "flex", flexDirection: "column",
          gap: 22, width: "100%", maxWidth: 340, marginTop: 18,
        }}>
          <Setting label="Large numbers">
            {[0, 1, 2, 3, 4].map((n) => (
              <Pill key={n} on={numLarge === n} onClick={() => setNumLarge(n)}>{n}</Pill>
            ))}
          </Setting>

          <Setting label="Target">
            <Pill on={!solvableOnly} onClick={() => setSolvableOnly(false)}>Authentic</Pill>
            <Pill on={solvableOnly} onClick={() => setSolvableOnly(true)}>Solvable</Pill>
          </Setting>

          <Setting label="Round length">
            {ROUND_LENGTHS.map((len) => (
              <Pill key={len} on={timeChoice === len} onClick={() => setTimeChoice(len)}>{len}s</Pill>
            ))}
          </Setting>

          <Setting label="Rounds">
            {ROUND_CHOICES.map((n) => (
              <Pill key={n} on={rounds === n} onClick={() => setRounds(n)}>{n}</Pill>
            ))}
          </Setting>

          {/* Two ways to play: solo on-device, or a room over the network */}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              onClick={() => startSession(timeChoice)}
              style={{ ...primaryBtn(T), flex: 1, gap: 8, letterSpacing: 1 }}
            >
              <PersonIcon variant="single" size={19} color={T.onAccent} />
              Single
            </button>
            <button
              onClick={multiplayerAvailable ? () => onTogether?.({ bestOf: rounds, roundSeconds: timeChoice }) : undefined}
              disabled={!multiplayerAvailable}
              aria-disabled={!multiplayerAvailable}
              style={{
                ...secondaryBtn(T), flex: 1, height: 52, gap: 8,
                opacity: multiplayerAvailable ? 1 : 0.5,
                cursor: multiplayerAvailable ? "pointer" : "not-allowed",
              }}
            >
              <PersonIcon variant="double" size={21} color={T.text} />
              Together
            </button>
          </div>

          {(!multiplayerAvailable || multiWarning) && (
            <p style={{ fontFamily: T.mono, fontSize: 11, lineHeight: 1.6, color: multiWarning ? T.red : T.dim, textAlign: "center", margin: "-8px 4px 0" }}>
              {multiWarning || "Multiplayer isn’t configured — local play only."}
            </p>
          )}

          <button
            onClick={() => setShowHelp(true)}
            style={{
              alignSelf: "center", background: "none", border: "none",
              color: T.muted, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 3, marginTop: 2,
            }}
          >
            How to play
          </button>
        </div>
      )}

      {/* ── PLAY ────────────────────────────────────────────── */}
      {displayPhase === PHASES.PLAY && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: T.gap.lg, maxWidth: 420, width: "100%",
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, letterSpacing: 1 }}>
            Round {roundNo} of {rounds} · {totalPts} pts
          </div>
          <TargetPanel
            target={target}
            seconds={seconds}
            total={roundLength}
            running={running}
            finished={!running}
            perfect={bestResult === target}
            revealing={revealing}
            roundId={roundId}
            onRevealed={handleRevealed}
          />

          {/* Tiles */}
          <div style={{
            display: "flex", gap: T.gap.sm, flexWrap: "wrap",
            justifyContent: "center", minHeight: 58,
          }}>
            {numbers.map((n, i) => usedIndices.has(i) ? null : (
              <div
                key={`n-${i}`}
                style={{
                  // Each tile lands on its own click, so the delay here is the
                  // same TILE_DEAL_MS the sound uses. Only while revealing:
                  // afterwards the tiles must reappear instantly, so undoing a
                  // calculation puts its two numbers straight back.
                  animation: REDUCED || !revealing
                    ? "none"
                    : "popIn 0.34s cubic-bezier(.34,1.4,.5,1) both",
                  animationDelay: revealing && liveSteps.length === 0
                    ? `${i * TILE_DEAL_MS}ms`
                    : "0ms",
                }}
              >
                <NumberTile
                  value={n}
                  selected={currentA?.sourceType === "number" && currentA?.sourceIndex === i}
                  onClick={() => selectNumber(n, "number", i)}
                />
              </div>
            ))}
            {intermediates.map((im, i) => (!im || usedIntermediates.has(i)) ? null : (
              <div key={`i-${i}`} style={{ animation: "popIn 0.25s ease" }}>
                <NumberTile
                  value={im.value} calculated
                  selected={currentA?.sourceType === "intermediate" && currentA?.sourceIndex === i}
                  onClick={() => selectNumber(im.value, "intermediate", i)}
                  onDoubleClick={() => undoIntermediate(i)}
                />
              </div>
            ))}
          </div>

          {/* Expression + operator pad */}
          <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 12, width: "100%",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 56px)",
              gridTemplateRows: "repeat(2, 56px)",
              gap: T.gap.sm,
            }}>
              {OPERATORS.map(op => (
                <OpButton
                  key={op} op={op}
                  active={currentOp === op}
                  enabled={currentA !== null || lastCalcIndex >= 0}
                  onClick={() => handleOperator(op)}
                />
              ))}
            </div>

            <div style={{
              width: "100%", minHeight: 32,
              fontFamily: T.mono, fontSize: 20,
              display: "flex", flexDirection: "row", gap: 8,
              alignItems: "center", justifyContent: "center",
              textAlign: "center",
            }}>
              {currentA !== null ? (
                <>
                  <span style={{
                    color: currentA.sourceType === "intermediate" ? T.orange : T.cyan,
                    opacity: currentA.implied ? 0.85 : 1,
                  }}>
                    {currentA.value}
                    {currentA.implied && (
                      <span style={{ fontSize: 10, color: T.muted, marginLeft: 5 }}>cont.</span>
                    )}
                  </span>
                  <span style={{ color: currentOp ? T.gold : T.mutedLight, fontSize: 22 }}>
                    {currentOp || "·"}
                  </span>
                  <span style={{ color: T.mutedLight }}>{currentOp ? "?" : ""}</span>
                </>
              ) : (
                <span style={{ color: T.muted, fontSize: 12, lineHeight: 1.5 }}>
                  {lastCalcIndex >= 0
                    ? <>Tap a number,<br />or an operator to<br />carry on from {intermediates[lastCalcIndex].value}.</>
                    : <>Tap a number,<br />then an operator.</>}
                </span>
              )}
            </div>
          </div>

          {liveSteps.length > 0 && <StepList steps={liveSteps} label="Working" />}

          {intermediates.some(Boolean) && (
            <div style={{ fontSize: 10.5, color: T.dim, fontFamily: T.mono }}>
              double-tap an amber tile to undo
            </div>
          )}

          <div style={{ display: "flex", gap: T.gap.sm }}>
            {/* Three levels, so the row has a clear hierarchy: Cancel is the
                lightest (quiet text, and live only mid-pick — which is what
                sets it apart from Reset, that wipes the whole board), Reset is
                outline, Submit is the filled commit action. */}
            <button
              onClick={() => { setCurrentA(null); setCurrentOp(null); }}
              disabled={currentA === null && currentOp === null}
              style={{
                ...tertiaryBtn(T),
                opacity: currentA === null && currentOp === null ? 0.4 : 1,
                cursor: currentA === null && currentOp === null ? "default" : "pointer",
              }}
            >
              Cancel
            </button>
            <button onClick={resetAll} style={secondaryBtn(T)}>Reset</button>
            <button onClick={endRound} style={filledRowBtn(T)}>Submit</button>
          </div>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────── */}
      {displayPhase === PHASES.RESULT && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: T.gap.lg, maxWidth: 420, width: "100%",
        }}>
          <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, letterSpacing: 1, textAlign: "center" }}>
            Round {roundNo} of {rounds} · {totalPts} pts total
          </div>
          <div style={{
            fontFamily: T.sans, fontSize: 16, fontWeight: 700, letterSpacing: 0.5, textAlign: "center",
            color: perfect ? T.gold : score > 0 ? T.violet : T.red,
          }}>
            {perfect ? "Spot on." : score === 7 ? "Within five." : score === 5 ? "Within ten." : "Nothing in range."}
            <span style={{ color: T.muted, fontFamily: T.mono, fontSize: 13, fontWeight: 500 }}>
              {"  ·  "}+{score} pts
            </span>
          </div>

          <PuzzlePanel target={target} numbers={numbers} perfect={perfect} />

          <ResultCarousel cards={resultCards} target={target} resetKey={roundId} />

          {sessionComplete ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", alignItems: "center" }}>
              <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, color: T.text }}>
                Session complete · {totalPts} / {rounds * 10} pts
              </div>
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button onClick={playAgain} style={{ ...primaryBtn(T), flex: 1 }}>Play again</button>
                <button onClick={newGame} style={{ ...secondaryBtn(T), flex: 1, height: 52 }}>Settings</button>
              </div>
            </div>
          ) : (
            <button onClick={nextRound} style={primaryBtn(T)}>Next round</button>
          )}
        </div>
      )}

      </div>{/* end animated phase container */}

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}

      <div style={{
        marginTop: "auto", paddingTop: 28,
        fontSize: 10, color: T.dim, fontFamily: T.mono, letterSpacing: 2.5,
      }}>
        PICK · CALCULATE · COUNTDOWN
      </div>
    </div>
  );
}
