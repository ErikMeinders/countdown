import { useTheme } from "../../theme-context.jsx";
import { primaryBtn, secondaryBtn } from "../../styles.js";
import { MpFrame } from "./MpFrame.jsx";

// The multiplayer landing: create a room or join one. No accounts, no email —
// just a choice.
export function Landing({ onCreate, onJoin, onExit }) {
  const T = useTheme();
  return (
    <MpFrame title="Play together" onLeave={onExit}>
      <div style={{ display: "flex", flexDirection: "column", gap: T.gap.md, marginTop: 24 }}>
        <button onClick={onCreate} style={{ ...primaryBtn(T), height: 60 }}>
          Create room
        </button>
        <button onClick={onJoin} style={{ ...secondaryBtn(T), height: 60, fontSize: 15 }}>
          Join room
        </button>
      </div>
      <p style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, textAlign: "center", lineHeight: 1.6 }}>
        Create a room to get a code and QR to share,
        <br />
        or join with a code a friend sends you.
      </p>
    </MpFrame>
  );
}
