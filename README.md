# Countdown — Numbers Round

The Countdown numbers round as an installable web app. React + Tone.js, built
with Vite, published to GitHub Pages.

**Play:** <https://erikmeinders.github.io/countdown/>

## Working on it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests + a render smoke test
npm run build      # production build into dist/
npm run preview    # serve dist/ exactly as it will be published
```

Nothing generated is committed. `dist/` is built by CI on every push to `main`
and published from there — see [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

Pages must be set to **Settings → Pages → Source: GitHub Actions**.

## Layout

```
index.html               Shell: viewport, iOS meta tags, safe-area handling
src/
  main.jsx               Mounts React, registers the service worker
  App.jsx                The game: phases, round state, layout
  theme.js               Design tokens (T) and the urgency colour ramp
  styles.js              Shared inline style objects
  constants.js           Phases, and the reduced-motion switch
  sound.js               Tone.js engine — every call is failure-tolerant
  sw-template.js         Service worker source (see below)
  Shell.jsx              Mode selection (local vs multiplayer) + deep links
  routing.js             Hash-based /#/join/CODE deep-link parsing
  game/
    rules.js             Tile and target generation, the four operations
    solver.js            Exhaustive search for the best line
    trace.js             Walks a result back to the tiles that made it
    shared/              Pure logic reused by multiplayer (calculator, expression, timing)
    multiplayer/         Result-card ordering
  screens/               Home + multiplayer/ screens (lobby, round, results…)
  services/              config, protocol, WebSocket client, dev mock transport
  state/                 Multiplayer reducer state-machine + useMultiplayer hook
  components/            One component per file, all presentational
    mp/                  Multiplayer-only widgets (QR, score pips, result cards…)
  styles/animations.css  Keyframes and the few global rules
public/                  Icons, manifest, .nojekyll — copied verbatim
test/                    Vitest (test/mp/ covers multiplayer)
backend/                 Serverless multiplayer backend (see backend/README.md)
deploy/aws/              Optional S3 + CloudFront target for the frontend
```

## Two modes: local and together

The app opens on a mode choice:

- **Play locally** — the original single-player game. All puzzle generation,
  solving, validation, timing and scoring stay on the device; no backend, works
  fully offline once the PWA is installed. This code path never opens a socket.
- **Play together** — a server-backed room: one player creates a room, others
  join by QR code or a four-character code, everyone gets the *same*
  server-generated puzzle, solves independently, and the results reveal
  together. Best of five. Needs the backend and a network connection.

The two are separate subtrees, so a multiplayer connectivity problem can never
affect local play.

### Configuring the multiplayer backend

The multiplayer endpoint is a build-time variable (Vite convention,
`VITE_` prefix). With it unset the app still runs — "Play together" is disabled
with an explanation and local play is untouched.

```bash
cd backend
export AWS_PROFILE=my-profile
make deploy
export COUNTDOWN_WEBSOCKET_URL="$(make -s websocket-url)"
cd ..

printf 'VITE_COUNTDOWN_WEBSOCKET_URL=%s\n' "$COUNTDOWN_WEBSOCKET_URL" > .env.local

npm install
npm run dev
```

`.env.local` is git-ignored (via `*.local`); commit only `.env.example`, which
holds a placeholder. See [`backend/README.md`](backend/README.md) for deploying
the backend and retrieving the URL.

**Environments.** The backend template is environment-parameterised, so `dev`
and `prod` are independent stacks — separate tables and separate URLs:

```bash
cd backend && export AWS_PROFILE=…
make deploy ENVIRONMENT=prod STACK_NAME=countdown-backend-prod
```

The published site (GitHub Pages, from `main`) is built against the **prod**
backend. Its URL lives in the `VITE_COUNTDOWN_WEBSOCKET_URL` GitHub Actions
variable (repo Settings → Secrets and variables → Actions) and is injected into
the Pages build — never committed. Local development points at the **dev** stack
through your `.env.local`, so infra changes can be shaken out without touching
prod.

### How QR joining works

The lobby shows a QR code and a copyable link. The link is a normal HTTPS URL of
the form `https://<host>/<base>/#/join/ABCD` — a **hash** route on purpose: the
app is served from a sub-path with a relative asset base, so a real
`/join/ABCD` path would break asset loading on static hosting and require an SPA
fallback. The hash keeps the document at the app root and needs no server
config, so deep links work on GitHub Pages, CloudFront, and offline. Scanning
opens the app straight into the join screen with the code pre-filled.

### Testing two players

- **Two windows/devices:** open the app, **Play together → Create room**, then
  scan the QR (or open the copied link) on a second device or a second browser
  window, and **Join**. Both mark ready to start.
- **One browser, no backend:** run `npm run dev` and open
  `http://localhost:5173/?mock=1`. A scripted opponent ("Robo") joins, readies,
  and answers, so you can walk the whole flow — create, lobby, round, results,
  match win — solo. Mock mode is dev-only and never in a production build.

### Offline & reconnection limitations

- **Offline:** local play works fully offline. The multiplayer *screens* load
  from the cached app shell, but multiplayer *actions* need a connection and say
  so; the service worker never caches WebSocket traffic.
- **Reconnection:** on a transient drop the client keeps the UI visible, shows a
  reconnecting indicator, and retries with bounded backoff. When the socket
  comes back it re-announces itself on the `reconnect` route and the server
  replies with a whole-room snapshot — the room, the live round with the
  server's own clock, your best answer so far, and any result you were away
  for — so play resumes where you left it. A snapshot rather than a replay,
  because a client that missed two rounds can't be caught up by frames it never
  received. If it still doesn't recover, use **Try again** / **Leave**.
- **Not** resumed: a full page reload. The player ID lives in `sessionStorage`,
  so the tab still has it, but rejoining automatically on load would race the
  create/join the player may have intended instead. That wants a deliberate
  "resume your room?" prompt.
- **Deadline finalisation is lazy** on the backend, so a round where one player
  never answers is finalised on the next interaction; the client nudges this
  automatically at the deadline.
- **No in-place rematch** yet: at match end, **New game** returns to the
  multiplayer landing to create a fresh room rather than faking a restart.

## Notes

- **Everything is relative.** The app is served from `/countdown/`, not the
  domain root, so `base` is `"./"` in `vite.config.js` and every path in
  `index.html` and `manifest.json` is written `./like-this`. Rename the repo
  and it keeps working; switch any path to `/like-this` and it breaks.

- **The service worker is generated.** `vite.config.js` fills
  `src/sw-template.js` in from the finished `dist/`: the precache list is the
  real file names, and the cache name is a hash of their contents. That means
  there is no `CACHE = "countdown-v3"` constant to remember to bump, and no way
  for an installed copy to keep serving a stale build. Edit the template, never
  `dist/sw.js`.

- **Sound is decoration.** Every method on `Sound` is wrapped so a fault in the
  audio engine can't stop the game — which matters most for `reels()`, since
  the clock doesn't start until the reels settle.

- **The solver is exhaustive** and runs on the main thread, 30 ms after the
  round ends. Six tiles is small enough that this is imperceptible.

- **`.nojekyll`** is kept in `public/` so the build still works if Pages is
  ever switched back to deploying from a branch.

## Install it on the iPhone

Open the URL **in Safari** — not Chrome, and not the in-app browser in Slack or
Mail, neither of which offers the option. Share → **Add to Home Screen**.

It launches fullscreen with no address bar, and works with no signal.

## History

The game began as a Claude artifact and was deployed for a while as a
pre-bundled `app.js` committed at the repo root. Fixes were made by editing
that minified file directly, which is where the regressions came from. The JSX
behind the last such build is the source in `src/` today; see
[CHANGELOG.md](CHANGELOG.md).
