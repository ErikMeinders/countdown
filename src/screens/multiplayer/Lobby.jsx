import { useState } from "react";

import { Sound } from "../../sound.js";
import { useTheme } from "../../theme-context.jsx";
import { joinUrl } from "../../routing.js";
import { panelStyle, primaryBtn } from "../../styles.js";
import { HelpOverlay } from "../../components/HelpOverlay.jsx";
import { QRJoin } from "../../components/mp/QRJoin.jsx";
import { CopyField } from "../../components/mp/CopyField.jsx";
import { MpFrame } from "./MpFrame.jsx";

// The waiting room: the code and QR to bring a second player in, the roster with
// readiness, and the "I'm ready" control. The round is started by the backend
// once everyone is ready — the client never starts a countdown on its own.
export function Lobby({ room, match, playerId, connectionState, onReady, onLeave }) {
  const T = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const players = room.players || [];
  const me = players.find((p) => p.playerId === playerId);
  const iAmReady = !!me?.ready;
  const activePlayers = players.filter((p) => p.active);
  const enoughPlayers = activePlayers.length >= 2;
  const url = joinUrl(room.code);

  return (
    <MpFrame
      title={`Room ${room.code}`}
      subtitle={`Best of ${match?.bestOf ?? 5}`}
      connectionState={connectionState}
      onLeave={onLeave}
    >
      {!enoughPlayers && (
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: 14, color: T.mutedLight, margin: 0 }}>
          Waiting for another player…
        </p>
      )}

      {!enoughPlayers && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <QRJoin url={url} size={172} />
          <CopyField label="Share link" value={url} mono={false} />
          <CopyField label="Room code" value={room.code} />
        </div>
      )}

      <div style={panelStyle(T)}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: T.muted,
            fontFamily: T.mono,
            marginBottom: 10,
          }}
        >
          Players
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {players.map((p) => (
            <li
              key={p.playerId}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontFamily: T.sans,
                fontSize: 15,
                color: p.active ? T.text : T.dim,
              }}
            >
              <span>
                {p.displayName}
                {p.playerId === playerId && <span style={{ color: T.muted }}> (you)</span>}
                {p.isHost && <span style={{ color: T.muted, fontSize: 12 }}> · host</span>}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: p.ready ? T.cyan : T.muted }}>
                {p.active ? (p.ready ? "✓ Ready" : "○ Not ready") : "offline"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {iAmReady ? (
        <p style={{ textAlign: "center", fontFamily: T.sans, fontSize: 14, color: T.cyan, margin: 0 }}>
          You're ready — waiting for the round to start…
        </p>
      ) : (
        <button
          onClick={() => {
            Sound.init?.();
            onReady();
          }}
          disabled={!enoughPlayers}
          style={{
            ...primaryBtn(T),
            width: "100%",
            opacity: enoughPlayers ? 1 : 0.5,
            cursor: enoughPlayers ? "pointer" : "not-allowed",
          }}
        >
          I'm ready
        </button>
      )}

      <button
        onClick={() => setShowHelp(true)}
        style={{
          alignSelf: "center", background: "none", border: "none",
          color: T.muted, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
          textDecoration: "underline", textUnderlineOffset: 3,
        }}
      >
        How to play
      </button>

      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </MpFrame>
  );
}
