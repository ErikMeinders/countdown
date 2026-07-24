import { useEffect } from "react";
import { T } from "../theme.js";
import { labelStyle, primaryBtn } from "../styles.js";
import { REDUCED } from "../constants.js";

function Chip({ children, kind = "given" }) {
  const map = {
    given: { c: T.cyan, b: T.cyanDim, bd: T.cyan },
    calc:  { c: T.orange, b: T.orangeDim, bd: T.orange },
    op:    { c: T.gold, b: T.goldDim, bd: T.gold },
  }[kind];
  return (
    <span style={{
      display: "inline-block", padding: "1px 6px", margin: "0 1px",
      borderRadius: T.r.sm, border: `1px solid ${map.bd}`,
      background: map.b, color: map.c,
      fontFamily: T.mono, fontSize: 12.5, fontWeight: 700,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function HelpSection({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ ...labelStyle, color: T.cyan, marginBottom: 7 }}>{title}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.65, color: T.textDim }}>
        {children}
      </div>
    </div>
  );
}

export function HelpOverlay({ onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const row = { display: "flex", gap: 8, marginBottom: 5 };
  const term = { color: T.text, fontWeight: 700, minWidth: 78, flexShrink: 0 };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(4,6,12,0.86)",
        backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center",
        alignItems: "flex-start",
        padding: "max(20px, env(safe-area-inset-top)) 14px max(20px, env(safe-area-inset-bottom))",
        overflowY: "auto",
        animation: REDUCED ? "none" : "fadeIn 0.2s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: `linear-gradient(180deg, ${T.bgLow}, ${T.bgMid})`,
          border: `1px solid ${T.panelBorder}`,
          borderRadius: T.r.lg,
          padding: 22,
          boxSizing: "border-box",
          animation: REDUCED ? "none" : "popIn 0.26s cubic-bezier(.34,1.3,.5,1)",
        }}
      >
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: 18,
        }}>
          <div>
            <div style={{
              fontFamily: T.sans, fontSize: 19, fontWeight: 700,
              letterSpacing: 2, color: T.text,
            }}>HOW TO PLAY</div>
            <div style={{
              fontFamily: T.mono, fontSize: 10, letterSpacing: 2.5,
              color: T.muted, marginTop: 2,
            }}>THE NUMBERS ROUND</div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, flexShrink: 0,
            borderRadius: T.r.md, border: `1px solid ${T.panelBorder}`,
            background: "transparent", color: T.mutedLight,
            fontSize: 17, cursor: "pointer", lineHeight: 1,
          }} aria-label="Close">×</button>
        </div>

        <HelpSection title="The idea">
          You get six numbers and a random three-digit target. Combine the
          numbers with <Chip kind="op">+</Chip> <Chip kind="op">−</Chip>{" "}
          <Chip kind="op">×</Chip> <Chip kind="op">÷</Chip> to hit the target,
          or get as close as you can before the clock runs out.
        </HelpSection>

        <HelpSection title="The rules">
          <div style={row}><span style={term}>Once each</span>
            <span>Every number can be used only once.</span></div>
          <div style={row}><span style={term}>Whole only</span>
            <span>Every step must give a positive whole number — no fractions,
              no negatives. <Chip>7</Chip>÷<Chip>2</Chip> is not allowed.</span></div>
          <div style={row}><span style={term}>Not all six</span>
            <span>You don't have to use every number.</span></div>
        </HelpSection>

        <HelpSection title="Playing a move">
          Tap a number, tap an operator, tap a second number. The result
          appears as a new amber tile you can keep using:
          <div style={{ margin: "9px 0 4px", fontFamily: T.mono, fontSize: 13 }}>
            <Chip>2</Chip> <Chip kind="op">+</Chip> <Chip>3</Chip>
            <span style={{ color: T.muted }}> → </span> <Chip kind="calc">5</Chip>
          </div>
        </HelpSection>

        <HelpSection title="Chaining">
          Once you have a result, tap an <em style={{ color: T.gold, fontStyle: "normal" }}>operator
          first</em> and it carries on from your most recent result — no need
          to re-select it:
          <div style={{ margin: "9px 0 4px", fontFamily: T.mono, fontSize: 13 }}>
            <Chip kind="op">×</Chip> <Chip>4</Chip>
            <span style={{ color: T.muted }}> → </span> <Chip kind="calc">20</Chip>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>
            Starting with a number instead always begins a fresh sum, so you can
            still build a separate line whenever you want.
          </div>
        </HelpSection>

        <HelpSection title="Fixing mistakes">
          <div style={row}><span style={term}>Undo</span>
            <span>Double-tap an amber tile to unpick that calculation and get
              its numbers back.</span></div>
          <div style={row}><span style={term}>Clear</span>
            <span>Drops the number/operator you're part-way through choosing.</span></div>
          <div style={row}><span style={term}>Reset</span>
            <span>Wipes all your working and starts the round over.</span></div>
          <div style={row}><span style={term}>Submit</span>
            <span>Ends the round early and scores where you got to.</span></div>
        </HelpSection>

        <HelpSection title="Scoring">
          <div style={row}><span style={term}>Exact</span><span>10 points</span></div>
          <div style={row}><span style={term}>Within 5</span><span>7 points</span></div>
          <div style={row}><span style={term}>Within 10</span><span>5 points</span></div>
          <div style={row}><span style={term}>Further off</span><span>nothing</span></div>
        </HelpSection>

        <HelpSection title="Before you start">
          <div style={row}><span style={term}>Large</span>
            <span>How many of your six come from 25, 50, 75, 100. The rest are
              drawn from 1–10.</span></div>
          <div style={row}><span style={term}>Authentic</span>
            <span>A purely random target, as on television — sometimes there is
              no exact answer.</span></div>
          <div style={row}><span style={term}>Solvable</span>
            <span>A target built from your tiles, so an exact answer always
              exists.</span></div>
          <div style={row}><span style={term}>30 / 60</span>
            <span>Seconds on the clock. It only starts once the target has
              finished rolling.</span></div>
        </HelpSection>

        <button onClick={onClose} style={{ ...primaryBtn, width: "100%", padding: "13px 0" }}>
          Got it
        </button>
      </div>
    </div>
  );
}
