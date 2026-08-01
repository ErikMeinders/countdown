import { useTheme } from "../../theme-context.jsx";

// A single labelled text input, sized for thumbs. Used for the display name and
// the room-code entry.
export function NameField({ label, value, onChange, placeholder, maxLength = 32, autoFocus, uppercase, onEnter, inputMode }) {
  const T = useTheme();
  return (
    <label style={{ display: "block", width: "100%" }}>
      {label && (
        <span
          style={{
            display: "block",
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: T.muted,
            fontFamily: T.mono,
            marginBottom: 6,
          }}
        >
          {label}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={autoFocus}
        inputMode={inputMode}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          width: "100%",
          height: 52,
          boxSizing: "border-box",
          padding: "0 16px",
          borderRadius: T.r.md,
          border: `1px solid ${T.hairStrong}`,
          background: T.surfaceLo,
          color: T.text,
          fontFamily: uppercase ? T.mono : T.sans,
          fontSize: uppercase ? 22 : 16,
          fontWeight: uppercase ? 700 : 500,
          letterSpacing: uppercase ? 6 : 0,
          textTransform: uppercase ? "uppercase" : "none",
          textAlign: uppercase ? "center" : "left",
          outline: "none",
        }}
      />
    </label>
  );
}
