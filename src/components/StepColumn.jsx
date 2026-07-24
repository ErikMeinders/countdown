import { T } from "../theme.js";
import { labelStyle } from "../styles.js";

// Compact, alignable step list used in the side-by-side result panel
export function StepColumn({ steps, label, align = "left", accent, target, empty }) {
  const right = align === "right";
  const calc = new Set();
  const badge = (isCalc, isHit) => ({
    display: "inline-block",
    padding: "1px 5px",
    borderRadius: T.r.sm,
    border: `1px solid ${isHit ? T.gold : isCalc ? T.orange : T.cyan}`,
    background: isHit ? T.goldDim : isCalc ? T.orangeDim : T.cyanDim,
    color: isHit ? T.gold : isCalc ? T.orange : T.cyan,
    fontWeight: 700,
    fontSize: 12.5,
    fontFamily: T.mono,
  });

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        ...labelStyle,
        color: accent || T.muted,
        textAlign: right ? "right" : "left",
        marginBottom: 10,
      }}>
        {label}
      </div>

      {steps.length === 0 ? (
        <div style={{
          fontFamily: T.mono, fontSize: 12, color: T.dim,
          textAlign: right ? "right" : "left",
        }}>
          {empty || "—"}
        </div>
      ) : steps.map((s, i) => {
        const aIsCalc = calc.has(s.a);
        const bIsCalc = calc.has(s.b);
        if (aIsCalc) calc.delete(s.a);
        if (bIsCalc) calc.delete(s.b);
        calc.add(s.result);
        const isHit = s.result === target;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap",
            justifyContent: right ? "flex-end" : "flex-start",
            padding: "3px 0",
            fontFamily: T.mono, fontSize: 12.5, color: T.muted,
          }}>
            <span style={badge(aIsCalc)}>{s.a}</span>
            <span style={{ color: T.mutedLight }}>{s.op}</span>
            <span style={badge(bIsCalc)}>{s.b}</span>
            <span style={{ color: T.dim }}>=</span>
            <span style={badge(true, isHit)}>{s.result}</span>
          </div>
        );
      })}
    </div>
  );
}
