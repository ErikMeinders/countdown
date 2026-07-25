# tools

## Icons

`make-icons.py` renders the four app icons in `public/` from the target-spinner
motif — three recessed reel windows showing a target — in the same JetBrains
Mono the game uses.

```bash
python3 tools/make-icons.py
```

Needs `rsvg-convert` (`brew install librsvg`). The JetBrains Mono TTF used for
the render lives in `tools/fonts/`; the committed `icon.svg` / `icon-maskable.svg`
are the last output, for reference.
