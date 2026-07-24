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
  game/
    rules.js             Tile and target generation, the four operations
    solver.js            Exhaustive search for the best line
    trace.js             Walks a result back to the tiles that made it
  components/            One component per file, all presentational
  styles/animations.css  Keyframes and the few global rules
public/                  Icons, manifest, .nojekyll — copied verbatim
test/                    Vitest
deploy/aws/              Optional S3 + CloudFront target
```

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
