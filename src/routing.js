// ── Deep-link routing ──────────────────────────────────────────
// Hash-based on purpose. The app is served from a sub-path (e.g. /countdown/)
// with a *relative* asset base, so a real path deep link like
// `/countdown/join/ABCD` would make the browser resolve `./assets/…` against
// `/countdown/join/` and fail to boot on static hosting. A hash keeps the
// document at the app root while still carrying the join route, and it needs no
// server-side SPA fallback — it works on GitHub Pages, CloudFront, and offline.

import { normalizeRoomCode } from "./services/protocol.js";

// The directory the app is served from, e.g. https://host/countdown/
export function appBaseUrl() {
  return new URL(".", document.baseURI).href;
}

// A shareable HTTPS join link (never the raw wss:// URL).
export function joinUrl(code) {
  return `${appBaseUrl()}#/join/${code}`;
}

// Parse a join code from the current location: hash first, then a ?join= query
// or a legacy /join/ path as fallbacks. Returns a normalized code or null.
export function parseJoinCode(loc = window.location) {
  const fromHash = (loc.hash || "").match(/#\/?join\/([^/?#]+)/i);
  const raw =
    (fromHash && fromHash[1]) ||
    new URLSearchParams(loc.search || "").get("join") ||
    (loc.pathname || "").match(/\/join\/([^/?#]+)/i)?.[1];
  if (!raw) return null;
  const { code, valid } = normalizeRoomCode(decodeURIComponent(raw));
  return valid ? code : null;
}

// Drop the join route from the address bar once consumed, without a reload.
export function clearJoinRoute() {
  if (/join/i.test(window.location.hash) || /[?&]join=/i.test(window.location.search)) {
    history.replaceState(null, "", appBaseUrl());
  }
}
