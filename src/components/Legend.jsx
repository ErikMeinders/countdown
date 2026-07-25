import { useTheme } from "../theme-context.jsx";

export function Legend() {
  const T = useTheme();
  const swatch = (style) => ({
    display: "inline-block", width: 10, height: 10, borderRadius: 2, ...style,
  });
  const items = [
    ["used", swatch({ border: `1.5px solid ${T.cyan}`, background: T.cyanDim })],
    ["unused", swatch({ border: `1.5px dashed ${T.hairStrong}`, background: "transparent" })],
    ["calculated", swatch({ border: `1.5px solid ${T.orange}`, background: T.orangeDim })],
  ];
  return (
    <div style={{
      display: "flex", gap: 14, justifyContent: "center", marginTop: 14, flexWrap: "wrap",
      fontSize: 10.5, fontFamily: T.mono,
    }}>
      {items.map(([label, style]) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={style} />
          <span style={{ color: T.mutedLight }}>{label}</span>
        </span>
      ))}
    </div>
  );
}
