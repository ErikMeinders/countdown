#!/usr/bin/env python3
"""Generate the app icons from the target-spinner motif.

Three dark recessed reel windows showing a target, on the app's background
gradient — the same face SlotNumber draws in the game. Rendered with
rsvg-convert. Run from the repo root: python3 tools/make-icons.py

The digits use Menlo here because JetBrains Mono (the app's mono) isn't a
system font; swap the font-family if you install it before regenerating.
"""

import subprocess
from pathlib import Path

TARGET = "952"          # a target reel windows would show mid-game
FONT = "JetBrains Mono, Menlo, monospace"

# Palette, lifted from src/theme.js
BG_LOW, BG_MID, BG = "#121a2b", "#0c1220", "#080a12"
CYAN = "#43ddcd"
FACE = "#000207"


def svg(scale: float) -> str:
    """scale is the motif's share of the 512 canvas (< 1 leaves a safe margin
    for the maskable icon, whose corners a launcher may crop to a circle)."""
    C = 512
    # Three windows in a row, sized as a block then centred.
    win_w, win_h, gap = 108, 168, 14
    block_w = 3 * win_w + 2 * gap
    # Apply the safe-zone scale about the canvas centre.
    win_w, win_h, gap, block_w = (v * scale for v in (win_w, win_h, gap, block_w))
    x0 = (C - block_w) / 2
    y0 = (C - win_h) / 2
    r = 12 * scale

    windows = []
    for i, digit in enumerate(TARGET):
        x = x0 + i * (win_w + gap)
        cx = x + win_w / 2
        windows.append(f'''
    <g>
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="{FACE}" stroke="rgba(255,255,255,0.22)"
            stroke-width="{2.4 * scale:.2f}"/>
      <text x="{cx:.1f}" y="{y0 + win_h / 2:.1f}" fill="{CYAN}"
            font-family="{FONT}" font-weight="700" font-size="{112 * scale:.0f}"
            text-anchor="middle" dominant-baseline="central">{digit}</text>
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="url(#lip)"/>
    </g>''')

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-10%" r="140%">
      <stop offset="0%"  stop-color="{BG_LOW}"/>
      <stop offset="45%" stop-color="{BG_MID}"/>
      <stop offset="100%" stop-color="{BG}"/>
    </radialGradient>
    <!-- The reel lip fade from src/components/SlotNumber.jsx, so the digit
         reads as lit glass rather than flat text. -->
    <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(10,13,22,0.95)"/>
      <stop offset="26%" stop-color="rgba(10,13,22,0)"/>
      <stop offset="74%" stop-color="rgba(10,13,22,0)"/>
      <stop offset="100%" stop-color="rgba(10,13,22,0.95)"/>
    </linearGradient>
  </defs>

  <rect width="{C}" height="{C}" fill="url(#bg)"/>
  {"".join(windows)}
</svg>'''


def render(svg_text: str, out: Path, size: int):
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out)],
        input=svg_text.encode(), check=True,
    )
    print(f"  {out}  {size}x{size}")


def main():
    pub = Path("public")
    full = svg(0.80)          # standard icons: motif fills most of the frame
    maskable = svg(0.58)      # maskable: motif inside the circular safe zone

    print("Rendering icons:")
    render(full, pub / "icon-512.png", 512)
    render(full, pub / "icon-192.png", 192)
    render(full, pub / "icon-180.png", 180)
    render(maskable, pub / "icon-maskable-512.png", 512)

    # Keep the source SVGs alongside for the next edit.
    (Path("tools") / "icon.svg").write_text(full)
    (Path("tools") / "icon-maskable.svg").write_text(maskable)


if __name__ == "__main__":
    main()
