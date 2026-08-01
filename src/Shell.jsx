import { useEffect, useState } from "react";

import App from "./App.jsx"; // the single-player game and shared parameters screen
import { MultiplayerApp } from "./screens/multiplayer/MultiplayerApp.jsx";
import { isMultiplayerConfigured, warnIfUnconfigured } from "./services/config.js";
import { createMockTransport } from "./services/mockTransport.js";
import { clearJoinRoute, parseJoinCode } from "./routing.js";
import { useTheme } from "./theme-context.jsx";

// Dev-only: `?mock=1` drives multiplayer with a scripted opponent and no
// backend. Never active in a production build.
function mockEnabled() {
  return (
    !!import.meta.env?.DEV &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mock") === "1"
  );
}

// The top-level shell. The app opens straight into single-player (the
// parameters screen); the two buttons there choose between playing solo and
// playing together. There is no splash. The single-player subtree never mounts
// a socket, so a multiplayer problem can't touch it.
export default function Shell() {
  const T = useTheme();
  const [mode, setMode] = useState("single"); // "single" | "multi"
  const [joinCode, setJoinCode] = useState(null);
  const [createParams, setCreateParams] = useState(null);
  const isMock = mockEnabled();
  const mpEnabled = isMultiplayerConfigured() || isMock;

  useEffect(() => {
    warnIfUnconfigured();
  }, []);

  // A /#/join/CODE deep link jumps straight into the join flow when available.
  useEffect(() => {
    const code = parseJoinCode();
    if (code && mpEnabled) {
      setJoinCode(code);
      setCreateParams(null);
      setMode("multi");
      clearJoinRoute();
    }
  }, [mpEnabled]);

  const goTogether = (params) => {
    setCreateParams(params || null);
    setJoinCode(null);
    setMode("multi");
  };
  const backToSingle = () => {
    setMode("single");
    setJoinCode(null);
  };

  if (mode === "multi") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(140% 100% at 50% -10%, ${T.bgLow} 0%, ${T.bgMid} 45%, ${T.bg} 100%)`,
          color: T.text,
          fontFamily: T.sans,
          padding: "16px 12px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <MultiplayerApp
          initialJoinCode={joinCode}
          createParams={createParams}
          createTransport={isMock ? createMockTransport() : undefined}
          onExit={backToSingle}
        />
      </div>
    );
  }

  return <App onTogether={goTogether} multiplayerAvailable={mpEnabled} multiWarning="" />;
}
