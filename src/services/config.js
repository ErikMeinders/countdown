// ── Multiplayer configuration ──────────────────────────────────
// The multiplayer backend URL is a build-time environment variable, read the
// Vite way. It is deliberately optional: with it unset the app still runs and
// local play is untouched — only "Play together" is disabled. Nothing here is
// hard-coded, and there is no default endpoint.
//
// Set it in a git-ignored .env.local at the repo root (see .env.example):
//   VITE_COUNTDOWN_WEBSOCKET_URL=wss://abc123.execute-api.eu-west-1.amazonaws.com/dev

// Read live (not module-load) so tests can stub the env per case.
export function getWebSocketUrl() {
  const raw = import.meta.env?.VITE_COUNTDOWN_WEBSOCKET_URL;
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed || null;
}

export function isMultiplayerConfigured() {
  return getWebSocketUrl() !== null;
}

// A one-line, developer-facing explanation for the disabled state. Shown in the
// UI when the variable is missing, and logged once so it's obvious in dev.
export const MISSING_URL_MESSAGE =
  "Multiplayer is not configured. Set VITE_COUNTDOWN_WEBSOCKET_URL to your " +
  "deployed backend URL (see backend/README.md) and rebuild.";

let warned = false;
export function warnIfUnconfigured() {
  if (!isMultiplayerConfigured() && !warned && import.meta.env?.DEV) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(`[countdown] ${MISSING_URL_MESSAGE}`);
  }
}
