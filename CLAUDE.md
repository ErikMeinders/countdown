# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Frontend (repo root):

```bash
npm install
npm run dev                       # http://localhost:5173
npm run dev  -- --host            # reachable from a phone on the LAN
npm test                          # vitest run (all of test/)
npm run test:watch
npx vitest run test/solver.test.js            # one file
npx vitest run -t "enters the lobby"          # one test by name
npm run build                     # dist/ (also generates dist/sw.js)
npm run preview                   # serve dist/ as it will be published
```

Backend (`backend/`, Python 3.13, needs `AWS_PROFILE` exported for AWS targets):

```bash
cd backend
python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements-dev.txt
make test                         # pytest, no AWS access
python3 -m pytest tests/test_scoring.py -k tie   # one file / one test
make validate                     # validate template.yaml
make deploy                       # build zip, upload, deploy CloudFormation
make deploy ENVIRONMENT=prod STACK_NAME=countdown-backend-prod
make -s websocket-url             # print only the wss:// URL (safe to capture)
aws logs tail /aws/lambda/countdown-ws-dev --follow
```

Wiring the two together (`.env.local` is git-ignored; only `.env.example` is committed):

```bash
printf 'VITE_COUNTDOWN_WEBSOCKET_URL=%s\n' "$(cd backend && make -s websocket-url)" > .env.local
```

There is no linter or formatter configured. CI (`.github/workflows/pages.yml`) runs
`npm ci && npm test && npm run build` and publishes `dist/` to GitHub Pages from `main`
only; the backend is not deployed by CI.

## Architecture

Two independent game paths behind one shell, deliberately kept apart:

- `src/Shell.jsx` decides between them. Opening screen is the single-player game
  (`src/App.jsx`), whose "Together" button hands the chosen round length/count up to the
  shell, which swaps in `src/screens/multiplayer/MultiplayerApp.jsx`.
- **Local play** (`src/App.jsx` + `src/game/{rules,solver,trace}.js`) generates, solves,
  validates, times and scores entirely on the device. It never opens a socket, so a
  multiplayer or network fault cannot reach it. It keeps its own inline copy of the
  tap-to-build calculator logic; `src/game/shared/calculator.js` is the multiplayer port
  of the same behaviour. That duplication is intentional — don't "unify" it.
- **Multiplayer** is a separate subtree: screens in `src/screens/multiplayer/`, widgets in
  `src/components/mp/`, transport in `src/services/`, state in `src/state/`.

Multiplayer data flow: `useMultiplayer` (the only React surface holding a socket) binds
`WebSocketClient` — or an injected transport — to the pure reducer in
`src/state/multiplayerMachine.js`. Screens read `state` and call intent-level actions;
server messages are the only way to change room phase, so illegal states stay unreachable.
Round timing comes from the server's `startsAt`/`endsAt` wall-clock stamps via
`src/game/shared/timing.js`, never from chained local timeouts.

The wire contract is mirrored in two files that must be changed together:
`src/services/protocol.js` (actions, message types, error codes, room-code alphabet) and
`backend/src/protocol.py` + `backend/src/domain/errors.py`.

Backend: one Lambda (`app.handler`) behind an API Gateway WebSocket API routed on
`$request.body.action`; `router.py` dispatches to thin `handlers/`, which delegate to
`services/game_service.py` over pure `domain/` logic and a `repositories/` interface.
`domain/` and `services/` are unit-tested against in-memory fakes with no AWS. Storage is
a single DynamoDB table keyed `PK = ROOM#<code>` so a whole match loads in one Query, plus
a `ConnectionIndex` GSI for `$disconnect` and TTL-based reaping. Concurrency-sensitive
moments (last join slot, round start, first result) use conditional writes or
`TransactWriteItems` — see `backend/README.md` for the full key design and route/payload
reference.

The server is authoritative: it generates the numbers and target, and it computes the
value of a submitted expression (`claimedResult` is ignored). Client animation never
determines a result.

## Invariants worth knowing

- **Every path is relative.** `base: "./"` in `vite.config.js`; paths in `index.html` and
  `manifest.json` are `./like-this`. An absolute path breaks the Pages sub-path deploy.
- **The service worker is generated.** The `serviceWorker()` plugin in `vite.config.js`
  fills `src/sw-template.js` from the finished `dist/`: precache list = real filenames,
  cache name = hash of their contents. Edit the template, never `dist/sw.js`; there is no
  cache constant to bump.
- **Deep links are hash routes** (`/#/join/ABCD`, parsed in `src/routing.js`) so static
  hosting needs no SPA fallback.
- **Sound is decoration.** Every `Sound` method in `src/sound.js` is failure-tolerant;
  this matters most for `reels()`, since the clock doesn't start until the reels settle.
- **Multiplayer is optional at build time.** With `VITE_COUNTDOWN_WEBSOCKET_URL` unset,
  `src/services/config.js` reports unconfigured, "Play together" is disabled with an
  explanation, and local play is unaffected. There is no default endpoint.
- **`?mock=1` in dev** (`src/services/mockTransport.js`) drives a scripted opponent
  through the whole multiplayer flow with no backend. Dev-only, never in a production build.
- **Themes:** colours come from `PALETTES` in `src/theme.js` via `theme-context.jsx`; the
  reels stay dark in both palettes (`DISPLAY`), like a real clock face.
- Nothing generated is committed — `dist/` is built by CI.

## Known protocol gaps (documented, not bugs)

Reconnect cannot re-bind a socket to an existing player (no backend reconnect route or
room snapshot); round finalisation at the deadline is lazy, so the client nudges it with
`nextRound`; capacity is two players; there is no in-place rematch. See the limitation
sections of `README.md` and `backend/README.md` before "fixing" any of these.
