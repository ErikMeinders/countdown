import { useState } from "react";
import { useTheme } from "../../theme-context.jsx";
import { normalizeRoomCode } from "../../services/protocol.js";
import { primaryBtn } from "../../styles.js";
import { NameField } from "../../components/mp/NameField.jsx";
import { MpFrame } from "./MpFrame.jsx";

// Shared name (and, when joining, code) entry. The last-used display name is
// pre-filled but always editable. Room codes are normalized and validated
// before the button enables, with clear inline errors.
export function NameEntry({ mode, initialName = "", initialCode = "", error, busy, onSubmit, onBack, onExit }) {
  const T = useTheme();
  const isJoin = mode === "join";
  const [name, setName] = useState(initialName);
  const [code, setCode] = useState(initialCode);

  const norm = normalizeRoomCode(code);
  const nameOk = name.trim().length > 0;
  const codeOk = !isJoin || norm.valid;
  const canSubmit = nameOk && codeOk && !busy;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(name.trim(), isJoin ? norm.code : undefined);
  };

  return (
    <MpFrame title={isJoin ? "Join room" : "Create room"} onLeave={onExit}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
        <button
          onClick={onBack}
          style={{
            alignSelf: "flex-start",
            height: 36,
            padding: "0 12px",
            borderRadius: T.r.md,
            border: `1px solid ${T.panelBorder}`,
            background: "transparent",
            color: T.mutedLight,
            fontFamily: T.sans,
            fontSize: T.type.sm,
            cursor: "pointer",
          }}
        >
          ‹ Back
        </button>
        {isJoin && (
          <NameField
            label="Room code"
            value={code}
            onChange={setCode}
            placeholder="ABCD"
            maxLength={4}
            uppercase
            autoFocus
            inputMode="text"
            onEnter={submit}
          />
        )}
        <NameField
          label="Your name"
          value={name}
          onChange={setName}
          placeholder="e.g. Erik"
          maxLength={32}
          autoFocus={!isJoin}
          onEnter={submit}
        />

        {isJoin && code.length > 0 && !norm.valid && (
          <p style={{ fontFamily: T.mono, fontSize: 11, color: T.red, margin: 0 }}>
            A room code is 4 letters/numbers.
          </p>
        )}
        {error && (
          <p role="alert" style={{ fontFamily: T.sans, fontSize: T.type.sm, color: T.red, margin: 0 }}>
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{ ...primaryBtn(T), width: "100%", opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
        >
          {busy ? "Connecting…" : isJoin ? "Join" : "Create"}
        </button>
      </div>
    </MpFrame>
  );
}
