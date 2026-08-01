# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning is
[semantic](https://semver.org/).

## [1.4.0] — 2026-08-01

Multiplayer. Released as commit `e4e612d` on 2026-08-01, which reached the
published site without a version bump or an entry here; this documents it.

### Added

- **"Play together"** — a server-backed room alongside the original game. One
  player creates a room, others join by QR code or a four-character code,
  everyone gets the *same* server-generated puzzle, solves independently, and
  the results reveal together. Best of five.
- A serverless backend in `backend/`: an API Gateway WebSocket API routed on
  `$request.body.action`, one python3.13 Lambda (`app.handler` → `router` →
  thin handlers → `GameService` → pure `domain/`), and a DynamoDB single table
  with a `ConnectionIndex` GSI and TTL expiry. The template is
  environment-parameterised, so `dev` and `prod` are independent stacks.
  Deployed by `make deploy`, never by CI.
- The server is authoritative: it generates the numbers and target, and it
  computes the value of a submitted expression — `claimedResult` is ignored, so
  no client animation can determine a result. Rounds run on the server's
  wall-clock `startsAt`/`endsAt`, so two phones stay in step.
- `src/services/protocol.js` — the wire contract as one module (actions,
  message types, error codes, builders, defensive parsing), mirroring
  `backend/src/protocol.py` and `backend/src/domain/errors.py`.
- `src/state/multiplayerMachine.js` — a pure reducer for the room lifecycle,
  free of React and of the socket, so server messages are the only way to move
  between phases. `useMultiplayer` is the one React surface that holds a socket.
- Hash-based deep links (`/#/join/ABCD`, `src/routing.js`), so a scanned QR
  code opens straight into the join screen with no SPA fallback on the host.
- Scored single-player sessions over N rounds with a running total, and a
  shared colour-coded step carousel for results in both modes.
- `?mock=1` in dev drives the whole multiplayer flow against a scripted
  opponent with no backend. Never present in a production build.

### Changed

- `src/Shell.jsx` now chooses between the two modes. The single-player subtree
  never mounts a socket, so a multiplayer or connectivity fault cannot reach
  local play, which stays fully on-device and offline.
- The multiplayer endpoint is the build-time `VITE_COUNTDOWN_WEBSOCKET_URL`.
  With it unset the app still runs: "Play together" is disabled with an
  explanation. There is no default endpoint, and no URL is committed — the
  published site gets the prod URL from an Actions variable.

### Known limitations

- A dropped socket cannot re-bind to its player: the backend has no reconnect
  route or room snapshot yet, so a client that doesn't recover must leave.
- Round finalisation is lazy — with no scheduler, a round whose clock expires
  before both players submit is finalised on the next interaction, which the
  client nudges at the deadline.
- Two players per room, and an exact tie awards nobody the round.

## [1.3.0] — 2026-07-25

### Added

- A 45-second round, between 30 and 60.
- Light / dark / auto themes. A control top-left, drawn in the same style as the
  sound toggle, cycles the three; "auto" follows the system and the choice is
  remembered. Two palettes live in `theme.js`, threaded through
  `theme-context.jsx`; `styles.js` became factories that take the active one.

### Changed

- The reels sit in a dark, lit-edged well, so the display stands out clearly
  from whatever is behind it — the light panel or the dark one. The reels stay
  a dark "clock face" in both themes; only the surrounding chrome changes.
- "Clear" is now "Cancel", and is live only while you're part-way through a
  pick — which is what sets it apart from Reset, that wipes the whole board.
- Operator buttons match the number tiles' size, with larger signs.
- A design pass over the whole button system, from a critical review. One
  hierarchy — solid-accent primary, outline secondary, quiet-text tertiary,
  segmented switch — replaces the mix of gradient blocks, ghost outlines and
  ad-hoc styles. The cyan→violet gradients are gone; a solid accent is now the
  one saturated element per screen, and it lands on the action that matters:
  Submit and New Round are primary, the 30/45/60 picks are quiet cards.
- Sizes snap to a 4px grid: tiles and operators 56, controls 44, picks 48,
  toggles 36, and the `gap` scale cleaned up to 4/8/12/16/24.
- Depth without noise, so the pared-back scheme doesn't read as flat: the
  primary key has a single-hue tonal fill, a fine top sheen and a soft accent
  glow (a lit surface, not the old two-hue diagonal); panels and cards carry a
  hairline lit edge; the background glows faintly indigo at the top. Cancel is
  boxed like its neighbours, just with the faintest border.
- The "NUMBERS ROUND" subtitle is gone.

## [1.2.0] — 2026-07-24

### Added

- `src/reels.js` — one description of the reel motion, which both the
  animation and the rattle are derived from. `test/reels.test.js` fails if the
  keyframes and the model drift apart.
- Self-hosted fonts. JetBrains Mono and Outfit ship in `public/fonts` and are
  precached, so the app keeps its type with no signal — the Google Fonts CDN
  can't be reached offline, and the icon is rendered from the same JetBrains
  Mono, so the two can no longer diverge.

### Changed

- The reels rattle once per numeral passing the window, on the curve the strip
  is actually following: 153 clicks fusing into a buzz at 250/s and separating
  into individual ticks at 2.3/s as it slows. Each click's level follows its
  gap, so the rattle thins and firms up together. Previously the clicks were a
  gap multiplied by a constant, unconnected to the animation.
- Softer stop: travel extended from 76% to 84% of the animation, the rock
  halved, and reels run 1700–2220 ms rather than 1450–1950 ms.
- The mute control is a drawn SVG rather than 🔊/🔇, which arrive in full
  colour on iOS and at a different weight on every platform.
- Both round-length buttons share one treatment; they previously ran the same
  gradient in opposite directions, which read as decoration standing in for a
  distinction.
- Decorative glow trimmed. Shadows now mean something: cyan lift on primary
  actions, gold for what you've selected, and the urgency glow on the clock.
- The reel windows pop harder, in the game and the icon alike: near-black
  faces, a brighter rim and top bevel, a dark shadow lifting them off the
  panel, and each digit blooming faintly in its own colour.
- New app icon: the target spinner itself — three recessed reel windows
  showing a target, on the app's background gradient. Rendered in JetBrains
  Mono to match the game, enlarged so the digits carry at small sizes while
  staying inside the maskable safe zone. Generated from `tools/make-icons.py`,
  so it can be regenerated rather than hand-drawn.

## [1.1.0] — 2026-07-24

Restores an audio and visual pass that was made in a parallel Codex session on
2026-07-21 (commit `12702ae`, "fix many UI issues") and then reverted by
`42e3686` the following day, which rebuilt `app.js` from an artifact that never
had it. Ported onto the current source, keeping the implicit-operand feature
`42e3686` introduced.

### Added

- A tile click voice: white noise through a highpass, replacing the plucked
  string used for every tap.
- The six tiles are dealt one at a time, each with its own click, before the
  reels spin. Previously they appeared in silence.
- Reels land on light ticks; the reel windows are dark recessed faces with an
  inset shadow, and keep that styling once they stop.
- `reelSettle` — reels overshoot and rock into place instead of easing to a
  stop.
- Keyboard focus rings via `:focus-visible`, and hover only behind
  `@media (hover: hover)` so it can't stick after a tap.

### Changed

- Contrast pass over the whole palette: every foreground colour lifted.
- The countdown bass moved up an octave (D1 → D2) and the low tones under the
  reel stops, time-up and failure cues were cut or shortened. Nothing now
  reaches below D2.
- The solver prefers the shortest exact answer, and each candidate carries the
  steps that produced it — so a reported solution no longer includes
  operations that fed values the answer never used.
- The operator pad is centred, with the expression under it rather than beside
  it.

### Fixed

- iOS no longer paints a white flash on tap: `color-scheme: dark` plus an
  appearance reset on buttons.
- A tile already equal to the target is again reported as a zero-step answer.
  Codex's fast path would have answered a target of 100 with `25 + 75` while a
  100 tile sat on the board.

## [1.0.0] — 2026-07-24

First release built from source. No gameplay changes: this is the same game as
the `42e3686` deploy, rebuilt from the JSX it was compiled from.

### Added

- Vite build, so `app.js` is generated rather than committed and hand-edited.
- Vitest suite covering the rules, the solver, the tile trace, and a jsdom
  render pass over pick → play → result.
- Service worker generation from the finished build: the precache list is the
  real output file names and the cache name is a hash of their contents, so a
  stale cache can no longer outlive a deploy.
- GitHub Actions builds and tests pull requests, and publishes `main`.
- `CHANGELOG.md`, and a `.npmrc` pinning the public registry.

### Changed

- Source split out of one 1772-line file into `src/game/`, `src/components/`
  and the modules listed in the README.
- Pages now deploys the built `dist/` via GitHub Actions rather than serving
  the repo root from a branch.
- The inline `<style>` block moved to `src/styles/animations.css`; its
  duplicate font `@import` is gone, since `index.html` already loads them.
- `deploy/aws/deploy.sh` builds first and uploads `dist/`, and no longer caches
  `manifest.json` as immutable.

### Removed

- The committed `app.js` bundle and the hand-maintained `sw.js`.
- Two dead declarations carried along in the artifact: `PHASE_MS` and the
  unused `stage` / `setStage` state.

## [0.x] — before 2026-07-22

Developed as a Claude artifact, deployed as a pre-bundled `app.js` at the repo
root. Later fixes (`a7c758b`, `12702ae`, `42e3686`) were applied to the
minified bundle directly.
