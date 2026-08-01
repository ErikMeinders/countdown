import { useState } from "react";
import { useTheme } from "../../theme-context.jsx";

// A read-only value (join link, room code) with a big, obvious copy button —
// no tiny controls. Falls back gracefully if the clipboard API is unavailable.
export function CopyField({ label, value, mono = true }) {
  const T = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {label && (
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: T.muted,
            fontFamily: T.mono,
            marginBottom: 6,
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
            height: 44,
            borderRadius: T.r.md,
            border: `1px solid ${T.panelBorder}`,
            background: T.surfaceLo,
            fontFamily: mono ? T.mono : T.sans,
            fontSize: 13,
            color: T.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </div>
        <button
          onClick={copy}
          aria-label={`Copy ${label || "value"}`}
          style={{
            height: 44,
            minWidth: 72,
            padding: "0 14px",
            borderRadius: T.r.md,
            border: `1px solid ${T.hairStrong}`,
            background: copied ? T.cyanDim : "transparent",
            color: copied ? T.cyan : T.text,
            fontFamily: T.sans,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
