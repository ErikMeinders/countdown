---
name: run-countdown
description: Build, launch, drive and screenshot the Countdown PWA — the single-player game and the multiplayer room flow — in a real browser. Use when asked to run, start, open, or screenshot the app, to see a change working in the real UI, to compare light and dark themes, or to measure the rendered design (font sizes, tracking, contrast). Also covers the frontend and backend test suites.
---

# Running Countdown

A Vite + React PWA, served from a sub-path, with a mock-driven multiplayer mode.
It is driven by **`.claude/skills/run-countdown/driver.mjs`**, which walks the
real UI in Chrome via Playwright — clicking through setup → play → result and
the room flow, and screenshotting both themes.

All paths below are relative to the repo root. Verified on macOS 15 (arm64),
Node 22, Chrome installed at `/Applications/Google Chrome.app`.

## Prerequisites

Playwright is deliberately **not** a project dependency — CI never drives a
browser, and adding it would slow `npm ci` for nothing. Install it once, into a
scratch directory outside the repo:

```bash
mkdir -p /tmp/countdown-driver-deps
printf 'registry=https://registry.npmjs.org/\n' > /tmp/countdown-driver-deps/.npmrc
(cd /tmp/countdown-driver-deps && npm i playwright)
```

The `.npmrc` line is **not optional** — see Gotchas. No `npx playwright install`
is needed: the driver launches the installed Google Chrome.

## Build

```bash
npm install
npm run build     # -> dist/, and generates dist/sw.js from src/sw-template.js
```

## Run (agent path)

Start the dev server, then drive it. The driver finds the port itself.

```bash
npm run dev > /tmp/countdown-dev.log 2>&1 &
sleep 4 && grep -o "http://localhost:[0-9]*" /tmp/countdown-dev.log | head -1
```

```bash
# Every screen, both themes -> 14 PNGs. ~33s.
node .claude/skills/run-countdown/driver.mjs shots /tmp/countdown-shots

# One flow. setup | play | result | mp. THEME=light|dark (default dark).
THEME=light node .claude/skills/run-countdown/driver.mjs screen setup /tmp/countdown-one

# Computed styles of every control, plus a distinct-values summary.
node .claude/skills/run-countdown/driver.mjs measure
```

`shots` writes `<theme>-1-setup`, `-2-play`, `-3-working`, `-4-result`,
`-5-mp-landing`, `-6-mp-lobby`, `-7-mp-round`. **Open the PNGs.** A blank frame
means the flow broke, not that it passed.

`measure` prints height / radius / size / weight / tracking / font per element
and ends with `distinct font sizes:` and `distinct tracking:`. That summary is
the fastest way to catch design drift — it is how an eight-value type scale was
found that no screenshot made obvious.

Override the target with `BASE=http://localhost:4173` (e.g. to drive
`npm run preview` instead of the dev server).

## Run (human path)

```bash
npm run dev       # http://localhost:5173
npm run preview   # serves dist/ exactly as published
```

Add `?mock=1` in dev for multiplayer without a backend. Nothing here helps an
agent — no window, no way to click.

## Test

```bash
npm test                                    # vitest, 78 tests

cd backend && python3 -m venv .venv         # first time only
./.venv/bin/pip install -r requirements-dev.txt
./.venv/bin/python -m pytest                # 36 tests, no AWS access
```

## Gotchas

- **Installing playwright fails with `npm error ... npm login`.** The global npm
  config points at a CodeArtifact registry. Any scratch directory you install
  into needs its own `.npmrc` pinning the public registry — the repo carries one
  for the same reason. This is why the install line above is three commands.
- **Do not use the cached Playwright browsers.** They are routinely an older
  build than the installed package expects (`Executable doesn't exist at
  .../chromium_headless_shell-1234/...`). The driver launches
  `chromium.launch({ channel: "chrome" })` against the installed Google Chrome
  instead, which sidesteps a 100MB+ download. Do the same in any ad-hoc script.
- **`reducedMotion: "reduce"` is load-bearing, not cosmetic.** The app reads
  `prefers-reduced-motion` at module load: `SWAP_MS` drops to 0 and the round
  skips the six-second tile deal and reel spin, so the play screen is reachable
  immediately. Without it, a click on Single must be followed by a ~6s wait or
  you screenshot an empty board.
- **Button labels are uppercased in CSS**, and `innerText` returns the
  *transformed* text. Match case-insensitively (`/single/i`), or a matcher
  written against the JSX source silently finds nothing.
- **A selector that matches nothing looks like success.** A non-matching start
  button once produced a clean run that skipped four screenshots per theme with
  no error. The driver's `must()` throws instead; keep that behaviour.
- **Pin the theme via `localStorage`, don't click the toggle** — the toggle
  cycles auto → light → dark, so "click once for light" is wrong from a dark
  start. The driver sets `countdown-theme` in an init script before load.
- **`?mock=1` is dev-only** and never present in a production build. Real
  multiplayer needs `VITE_COUNTDOWN_WEBSOCKET_URL` in a git-ignored `.env.local`
  (see `backend/README.md`); without it "Play together" is disabled by design
  and the mp flows in `shots` will fail at the Together button.
- **Vite takes the next free port** when 5173 is busy, which happens whenever a
  previous `npm run dev` is still alive. The driver probes 5173–5176; if you
  hard-code a URL, read the port off the log first.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '.../backend/.claude/skills/...'` | You aren't in the repo root — the path in the error shows where you are. `cd` to the root; a shell that ran `cd backend` earlier keeps that directory. |
| `playwright not found` from the driver | Run the three-line install above. The driver prints it too. |
| `Executable doesn't exist at .../chromium_headless_shell-*` | You launched without `channel: "chrome"`. |
| `npm error ... npm login` installing playwright | Missing `.npmrc` in the scratch dir. |
| `No Vite dev server found on 5173-5176` | Start `npm run dev`, or pass `BASE=`. |
| `no element for: Together` | Multiplayer is unconfigured — use `?mock=1` (the driver does) or set `VITE_COUNTDOWN_WEBSOCKET_URL`. |
| Screenshots exist but are blank/all-background | The flow broke earlier; re-run a single `screen` and watch stdout. |
