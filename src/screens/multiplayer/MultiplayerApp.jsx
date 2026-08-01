import { useEffect, useRef, useState } from "react";

import { Phase, SubmissionState } from "../../state/multiplayerMachine.js";
import { useMultiplayer } from "../../state/useMultiplayer.js";
import { useTheme } from "../../theme-context.jsx";
import { useAnnouncer } from "../../components/mp/Announcer.jsx";
import { Landing } from "./Landing.jsx";
import { NameEntry } from "./NameEntry.jsx";
import { Lobby } from "./Lobby.jsx";
import { Round } from "./Round.jsx";
import { RoundResults } from "./RoundResults.jsx";
import { MatchResults } from "./MatchResults.jsx";

// Orchestrates the whole multiplayer experience: the pre-room flow (landing →
// name/code entry), then routing the machine's phase to a screen, plus the
// cross-cutting concerns — deadline handling, the reconnect banner, error
// surfacing, and screen-reader announcements.
export function MultiplayerApp({ initialJoinCode, createParams, onExit, createTransport }) {
  const T = useTheme();
  const { state, actions } = useMultiplayer({ createTransport });
  const [view, setView] = useState(initialJoinCode ? "join" : "landing");
  const [pending, setPending] = useState(false);
  const { announce, node } = useAnnouncer();

  const inRoom = state.phase !== Phase.NOT_IN_ROOM;

  // Leaving multiplayer entirely: drop the room and hand back to the shell,
  // which returns to the single-player parameters screen.
  const exit = () => {
    actions.leave();
    onExit?.();
  };

  // Clear the "connecting…" affordance once we're in a room or an error lands.
  useEffect(() => {
    if (inRoom || state.error) setPending(false);
  }, [inRoom, state.error]);

  // ── Announcements ──
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    if (state.phase === prevPhase.current) return;
    prevPhase.current = state.phase;
    if (state.phase === Phase.PLAYING && state.round) announce(`Round ${state.round.roundNumber} started.`);
    if (state.phase === Phase.ROUND_RESULT && state.result) {
      const you = state.result.winnerId === state.playerId;
      announce(state.result.isTie ? "Round tied." : you ? "You won the round." : "Opponent won the round.");
    }
    if (state.phase === Phase.MATCH_COMPLETE) {
      announce(state.result?.matchWinnerId === state.playerId ? "You won the match." : "Match complete.");
    }
  }, [state.phase, state.round, state.result, state.playerId, announce]);

  const activeCount = (state.room?.players || []).filter((p) => p.active).length;
  const prevActive = useRef(activeCount);
  useEffect(() => {
    if (activeCount > prevActive.current && state.phase === Phase.LOBBY) announce("A player joined.");
    prevActive.current = activeCount;
  }, [activeCount, state.phase, announce]);

  useEffect(() => {
    if (state.submission.state === SubmissionState.ACCEPTED) announce("Answer accepted.");
    if (state.submission.state === SubmissionState.IMPROVED) announce("Improved answer accepted.");
  }, [state.submission.state, announce]);

  // ── Round deadline ──
  const onDeadline = (best) => {
    if (best) actions.submitAnswer(best.expression, best.value);
    actions.markAwaitingResult();
    // If the opponent never submitted, nudge the backend to finalise.
    setTimeout(actions.forceFinalize, 1500);
  };

  const leaveToLanding = () => {
    actions.leave();
    setView("landing");
  };

  // ── Pre-room flow ──
  if (!inRoom) {
    if (view === "create") {
      return (
        <Screen node={node}>
          <NameEntry
            mode="create"
            initialName={state.displayName}
            busy={pending}
            error={state.error?.message}
            onSubmit={(name) => {
              actions.clearError();
              setPending(true);
              actions.createRoom(name, createParams);
            }}
            onBack={() => {
              actions.clearError();
              setView("landing");
            }}
            onExit={exit}
          />
        </Screen>
      );
    }
    if (view === "join") {
      return (
        <Screen node={node}>
          <NameEntry
            mode="join"
            initialName={state.displayName}
            initialCode={initialJoinCode || ""}
            busy={pending}
            error={state.error?.message}
            onSubmit={(name, code) => {
              actions.clearError();
              setPending(true);
              actions.joinRoom(code, name);
            }}
            onBack={() => {
              actions.clearError();
              setView("landing");
            }}
            onExit={exit}
          />
        </Screen>
      );
    }
    return (
      <Screen node={node}>
        <Landing onCreate={() => setView("create")} onJoin={() => setView("join")} onExit={exit} />
      </Screen>
    );
  }

  // ── In-room screens ──
  const common = {
    room: state.room,
    match: state.match,
    playerId: state.playerId,
    connectionState: state.connectionState,
    onLeave: exit,
  };

  let screen = null;
  if (state.phase === Phase.LOBBY) {
    screen = <Lobby {...common} onReady={actions.ready} />;
  } else if (state.phase === Phase.PLAYING || state.phase === Phase.AWAITING_RESULT) {
    screen = (
      <Round
        {...common}
        round={state.round}
        submission={state.submission}
        onSubmit={(expr, value) => actions.submitAnswer(expr, value)}
        onDeadline={onDeadline}
      />
    );
  } else if (state.phase === Phase.ROUND_RESULT) {
    screen = <RoundResults {...common} result={state.result} onReadyNext={actions.ready} />;
  } else if (state.phase === Phase.MATCH_COMPLETE) {
    screen = <MatchResults {...common} result={state.result} onNewGame={leaveToLanding} />;
  }

  const reconnecting = ["reconnecting", "error", "disconnected"].includes(state.connectionState);

  return (
    <Screen node={node}>
      {screen}
      {inRoom && reconnecting && (
        <div
          role="alert"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: `calc(12px + env(safe-area-inset-bottom))`,
            display: "flex",
            justifyContent: "center",
            padding: "0 12px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              maxWidth: 420,
              width: "100%",
              padding: "10px 14px",
              borderRadius: T.r.md,
              background: T.panel,
              border: `1px solid ${T.red}55`,
              boxShadow: "0 6px 24px rgba(0,0,0,0.4)",
              fontFamily: T.sans,
              fontSize: 13,
              color: T.text,
            }}
          >
            <span style={{ flex: 1 }}>
              Connection lost. Reconnecting…
              <br />
              <span style={{ fontSize: 11, color: T.muted }}>
                The room may not resume — see notes if this persists.
              </span>
            </span>
            <button onClick={actions.reconnect} style={miniBtn(T)}>
              Try again
            </button>
            <button onClick={exit} style={miniBtn(T)}>
              Leave
            </button>
          </div>
        </div>
      )}
      {inRoom && state.error && (
        <ErrorToast message={state.error.message} onDismiss={actions.clearError} />
      )}
    </Screen>
  );
}

function Screen({ node, children }) {
  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
      {children}
      {node}
    </div>
  );
}

function ErrorToast({ message, onDismiss }) {
  const T = useTheme();
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        top: `calc(12px + env(safe-area-inset-top))`,
        display: "flex",
        justifyContent: "center",
        padding: "0 12px",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: T.r.md,
          background: T.panel,
          border: `1px solid ${T.red}66`,
          fontFamily: T.sans,
          fontSize: 13,
          color: T.text,
        }}
      >
        <span style={{ flex: 1 }}>{message}</span>
        <button onClick={onDismiss} style={miniBtn(T)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

function miniBtn(T) {
  return {
    height: 32,
    padding: "0 12px",
    borderRadius: T.r.sm,
    border: `1px solid ${T.hairStrong}`,
    background: "transparent",
    color: T.text,
    fontFamily: T.sans,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}
