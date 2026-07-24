# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versioning is
[semantic](https://semver.org/).

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
