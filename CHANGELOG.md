# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning is
[semantic](https://semver.org/).

## [1.2.0] — 2026-07-24

### Added

- `src/reels.js` — one description of the reel motion, which both the
  animation and the rattle are derived from. `test/reels.test.js` fails if the
  keyframes and the model drift apart.

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
- New app icon: the target spinner itself — three recessed reel windows
  showing a target, on the app's background gradient. Generated from
  `tools/make-icons.py`, so it can be regenerated rather than hand-drawn.

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
