import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { T } from "./theme.js";
import { ghostBtn, labelStyle, panelStyle, primaryBtn } from "./styles.js";
import { PHASES, PHASE_ORDER, REDUCED, SWAP_MS } from "./constants.js";
import {
  OPERATORS, ROUND_LENGTHS,
  evaluate, generateNumbers, generateSolvableTarget, generateTarget,
} from "./game/rules.js";
import { solve } from "./game/solver.js";
import { traceTiles } from "./game/trace.js";
import { Sound } from "./sound.js";
import { HelpOverlay } from "./components/HelpOverlay.jsx";
import { Legend } from "./components/Legend.jsx";
import { NumberTile } from "./components/NumberTile.jsx";
import { OpButton } from "./components/OpButton.jsx";
import { StepColumn } from "./components/StepColumn.jsx";
import { StepList } from "./components/StepList.jsx";
import { TargetPanel } from "./components/TargetPanel.jsx";

// ── Main Game ──────────────────────────────────────────────────
export default function CountdownGame() {
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
  const [roundLength, setRoundLength] = useState(30);
  const [solvableOnly, setSolvableOnly] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [running, setRunning] = useState(false);
  const timerRef = useRef(null);

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
      Sound.reels();
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

  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(140% 100% at 50% -10%, ${T.bgLow} 0%, ${T.bgMid} 45%, ${T.bg} 100%)`,
      color: T.text, fontFamily: T.sans,
      padding: "16px 12px 24px",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      {/* Header */}
      <div style={{
        position: "relative", width: "100%", maxWidth: 420,
        textAlign: "center", marginBottom: 16,
      }}>
        <h1 style={{
          fontFamily: T.sans, fontSize: 26, fontWeight: 700, letterSpacing: 7, margin: 0,
          color: T.text, opacity: 0.92,
        }}>COUNTDOWN</h1>
        <div style={{
          fontFamily: T.mono, fontSize: 9.5, letterSpacing: 4,
          color: T.muted, marginTop: 3,
        }}>NUMBERS ROUND</div>
        <button
          onClick={() => { const n = !muted; setMuted(n); Sound.setMuted(n); }}
          style={{
            position: "absolute", top: -2, right: 0,
            width: 34, height: 34, borderRadius: T.r.md,
            border: `1px solid ${T.panelBorder}`,
            background: "transparent",
            color: muted ? T.dim : T.mutedLight,
            fontSize: 15, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
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
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: T.gap.xl, maxWidth: 400, width: "100%", marginTop: 24,
        }}>
          <div style={panelStyle}>
            <div style={{ ...labelStyle, textAlign: "center" }}>How many large numbers?</div>
            <div style={{ display: "flex", justifyContent: "center", gap: T.gap.sm, marginBottom: 14 }}>
              {[0, 1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setNumLarge(n)} style={{
                  width: 48, height: 48, borderRadius: T.r.md,
                  border: `1.5px solid ${n === numLarge ? T.cyan : "rgba(255,255,255,0.09)"}`,
                  background: n === numLarge ? T.cyanDim : "transparent",
                  color: n === numLarge ? T.cyan : T.mutedLight,
                  fontSize: 19, fontWeight: 700, fontFamily: T.mono,
                  cursor: "pointer", transition: "all 0.15s",
                }}>{n}</button>
              ))}
            </div>
            <div style={{ textAlign: "center", fontSize: 11.5, color: T.muted, fontFamily: T.mono }}>
              {numLarge} large · {6 - numLarge} small (1–10)
            </div>

            <div style={{
              marginTop: 18, paddingTop: 16,
              borderTop: `1px solid ${T.panelBorder}`,
            }}>
              <div style={{ ...labelStyle, textAlign: "center" }}>Target</div>
              <div style={{
                display: "flex", gap: 6,
                background: "rgba(255,255,255,0.03)",
                borderRadius: T.r.md, padding: 4,
              }}>
                {[
                  { v: false, label: "Authentic", hint: "may be unreachable" },
                  { v: true,  label: "Solvable",  hint: "always has an answer" },
                ].map(({ v, label, hint }) => (
                  <button
                    key={label}
                    onClick={() => setSolvableOnly(v)}
                    title={hint}
                    style={{
                      flex: 1, padding: "9px 6px",
                      borderRadius: T.r.sm, border: "none",
                      background: solvableOnly === v ? T.cyanDim : "transparent",
                      color: solvableOnly === v ? T.cyan : T.muted,
                      fontFamily: T.sans, fontSize: 12.5,
                      fontWeight: solvableOnly === v ? 700 : 500,
                      cursor: "pointer", transition: "all 0.18s",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div style={{
                textAlign: "center", marginTop: 8,
                fontSize: 10.5, color: T.dim, fontFamily: T.mono,
              }}>
                {solvableOnly
                  ? "built from your tiles — always reachable"
                  : "pure random, like the show — may be impossible"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: T.gap.md, width: "100%" }}>
            {ROUND_LENGTHS.map((len, i) => (
              <button
                key={len}
                onClick={() => startGame(len)}
                style={{
                  flex: 1,
                  padding: "14px 8px",
                  borderRadius: T.r.lg,
                  border: "none",
                  background: i === 0
                    ? `linear-gradient(135deg, ${T.cyan}, ${T.violet})`
                    : `linear-gradient(135deg, ${T.violet}, ${T.cyan})`,
                  color: "#08101a",
                  cursor: "pointer",
                  fontFamily: T.sans,
                  boxShadow: `0 6px 26px ${i === 0 ? T.cyanGlow : "rgba(139,127,212,0.2)"}`,
                  display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 1,
                  transition: "transform 0.1s",
                }}
              >
                <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, fontFamily: T.mono }}>
                  {len}
                </span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 2.5,
                  textTransform: "uppercase", opacity: 0.72,
                }}>
                  seconds
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowHelp(true)}
            style={{
              ...ghostBtn,
              display: "flex", alignItems: "center", gap: 8,
              marginTop: -6,
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 17, height: 17, borderRadius: "50%",
              border: `1px solid ${T.mutedLight}`,
              fontSize: 11, fontWeight: 700, fontFamily: T.sans,
            }}>?</span>
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
                  animation: REDUCED ? "none" : "popIn 0.34s cubic-bezier(.34,1.4,.5,1) both",
                  animationDelay: liveSteps.length === 0 ? `${i * 45}ms` : "0ms",
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
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 20, width: "100%",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 64px)",
              gridTemplateRows: "repeat(2, 64px)",
              gap: T.gap.md,
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
              flex: 1, minWidth: 0,
              fontFamily: T.mono, fontSize: 20,
              display: "flex", flexDirection: "column", gap: 4,
              alignItems: "flex-start",
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
                  <span style={{ color: currentOp ? T.gold : T.dim, fontSize: 22 }}>
                    {currentOp || "·"}
                  </span>
                  <span style={{ color: T.dim }}>{currentOp ? "?" : ""}</span>
                </>
              ) : (
                <span style={{ color: T.dim, fontSize: 12, lineHeight: 1.5 }}>
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

          <div style={{ display: "flex", gap: T.gap.md }}>
            <button onClick={resetAll} style={ghostBtn}>Reset</button>
            <button onClick={() => { setCurrentA(null); setCurrentOp(null); }} style={ghostBtn}>Clear</button>
            <button onClick={endRound} style={{ ...ghostBtn, borderColor: `${T.cyan}55`, color: T.cyan }}>
              Submit
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT ──────────────────────────────────────────── */}
      {displayPhase === PHASES.RESULT && (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: T.gap.lg, maxWidth: 420, width: "100%",
        }}>
          <div style={{
            ...panelStyle,
            textAlign: "center",
            border: `1px solid ${perfect ? `${T.gold}66` : T.panelBorder}`,
            animation: perfect ? "shimmer 2.4s ease-in-out infinite" : "none",
          }}>
            <div style={labelStyle}>Target</div>
            <div style={{
              fontFamily: T.mono, fontSize: 46, fontWeight: 700, lineHeight: 1,
              color: perfect ? T.gold : T.cyan,
            }}>{target}</div>

            {bestResult !== null && (
              <div style={{ marginTop: 10 }}>
                <span style={{ fontFamily: T.mono, fontSize: 12.5, color: T.mutedLight }}>
                  your answer{" "}
                </span>
                <span style={{
                  fontFamily: T.mono, fontSize: 19, fontWeight: 700,
                  color: perfect ? T.gold : score > 0 ? T.cyan : T.red,
                }}>{bestResult}</span>
              </div>
            )}

            <div style={{
              marginTop: 12, fontFamily: T.sans, fontSize: 15, fontWeight: 700,
              letterSpacing: 0.5,
              color: perfect ? T.gold : score > 0 ? T.violet : T.red,
            }}>
              {perfect ? "Spot on." : score === 7 ? "Within five." : score === 5 ? "Within ten." : "Nothing in range."}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, fontFamily: T.mono, marginTop: 4 }}>
              {score} point{score !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Recap: given numbers on top, solutions side by side below */}
          <div style={panelStyle}>
            <div style={{ ...labelStyle, textAlign: "center" }}>
              Given numbers
              {numbers.length > 0 && (
                <span style={{ color: T.dim, letterSpacing: 1 }}>
                  {"  ·  "}{answerTiles.size}/{numbers.length} used
                </span>
              )}
            </div>
            <div style={{
              display: "flex", gap: T.gap.sm, flexWrap: "wrap", justifyContent: "center",
              paddingBottom: 16,
              borderBottom: `1px solid ${T.panelBorder}`,
            }}>
              {numbers.map((n, i) => (
                <NumberTile key={i} value={n} compact faded={!answerTiles.has(i)} />
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "stretch", gap: 14, paddingTop: 16 }}>
              <StepColumn
                steps={liveSteps}
                label="Yours"
                align="left"
                accent={perfect ? T.gold : T.mutedLight}
                target={target}
                empty="no steps"
              />

              <div style={{ width: 1, background: T.panelBorder, flexShrink: 0 }} />

              <StepColumn
                steps={solution ? solution.steps : []}
                label={
                  solving ? "Solving…"
                    : !solution ? "Best"
                    : solution.exact ? "Best — exact"
                    : `Best — ${solution.diff} off`
                }
                align="right"
                accent={T.violet}
                target={target}
                empty={solving ? "…" : "a given number was closest"}
              />
            </div>

            <Legend />
          </div>

          <button onClick={newGame} style={primaryBtn}>New Round</button>
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
