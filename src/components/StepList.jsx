import { T } from "../theme.js";
import { labelStyle, numBadge, panelStyle } from "../styles.js";

export function StepList({ steps, label, accent }) {
  const calc = new Set();
  return (
    <div style={panelStyle}>
      <div style={{ ...labelStyle, color: accent || T.muted }}>{label}</div>
      {steps.map((s, i) => {
        const aIsCalc = calc.has(s.a);
        const bIsCalc = calc.has(s.b);
        if (aIsCalc) calc.delete(s.a);
        if (bIsCalc) calc.delete(s.b);
        calc.add(s.result);
        return (
          <div key={i} style={{
            fontFamily: T.mono, fontSize: 14, color: T.muted,
            padding: "4px 0",
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
          }}>
            <span style={numBadge(aIsCalc)}>{s.a}</span>
            <span style={{ color: T.mutedLight }}>{s.op}</span>
            <span style={numBadge(bIsCalc)}>{s.b}</span>
            <span style={{ color: T.muted }}>=</span>
            <span style={numBadge(true)}>{s.result}</span>
          </div>
        );
      })}
      {steps.length === 0 && (
        <div style={{ fontFamily: T.mono, fontSize: 13, color: T.muted }}>
          No operations needed — a source number is closest.
        </div>
      )}
    </div>
  );
}
