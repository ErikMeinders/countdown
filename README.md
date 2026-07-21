# Countdown — Numbers Round

The Countdown numbers round as an installable web app. No build step: React and
Tone.js are already compiled into `app.js`.

## Publish it

Create a **public** repo (private repos need a paid plan for Pages), then from
this folder:

```bash
git init -b main
git add -A
git commit -m "Countdown numbers round"
git remote add origin git@github.com:<you>/countdown.git
git push -u origin main
```

Then **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.

Give it a minute. The site appears at `https://<you>.github.io/countdown/`.

Or, with the GitHub CLI, the whole thing in one line:

```bash
gh repo create countdown --public --source=. --push
gh api -X POST repos/:owner/countdown/pages -f source[branch]=main -f source[path]=/
```

## Install it on the iPhone

Open `https://<you>.github.io/countdown/` **in Safari** — not Chrome, and not
the in-app browser in Slack or Mail, neither of which offers the option.

Share → **Add to Home Screen**.

It launches fullscreen with no address bar, and works with no signal.

## Notes

- **Everything is relative.** The app is served from `/countdown/`, not the
  domain root, so every path in `index.html`, `manifest.json` and `sw.js` is
  written `./like-this`. If you rename the repo it keeps working; if you switch
  any path to `/like-this` it will break.
- **`.nojekyll` matters.** Without it, Pages runs the repo through Jekyll,
  which skips files and folders beginning with an underscore.
- **After you redeploy**, bump `CACHE` in `sw.js` (`countdown-v1` →
  `countdown-v2`). The old cache is dropped on activate. Skip this and already
  installed copies keep serving the previous version indefinitely.
- **Removing it** is just a long-press on the icon → Delete. That also clears
  its cache.

## What's here

| File | |
|---|---|
| `index.html` | Shell: viewport, iOS meta tags, safe-area handling |
| `app.js` | The whole game, React + Tone bundled (418 KB) |
| `sw.js` | Service worker — cache-first, gives offline play |
| `manifest.json` | Name, icons, standalone display |
| `icon-*.png` | Home screen icons, including a maskable one for Android |
| `.nojekyll` | Stops Pages running Jekyll over the repo |
