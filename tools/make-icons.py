#!/usr/bin/env python3
"""Generate the app icons from the target-spinner motif.

Three recessed reel windows showing a target, on the app's background gradient
— the face SlotNumber draws, at rest. Rendered with rsvg-convert, in the same
JetBrains Mono the app uses (tools/fonts/JetBrainsMono-Bold.ttf), so the icon
and the game share one typeface.

The "lit reels" treatment (promoted from icon-proposal-1): bigger windows,
the brighter accentHi cyan on the digits, a stronger bloom, and a soft halo
behind the block, so the motif reads as a lit display rather than a quiet one.

Run from the repo root: python3 tools/make-icons.py
"""

import os
import subprocess
import tempfile
from pathlib import Path

TARGET = "952"          # a target reel windows would show mid-game

# Palette, lifted from src/theme.js
BG_LOW, BG_MID, BG = "#18233c", "#0c1220", "#080a12"
CYAN_HI = "#5ce8da"     # accentHi — brighter than DISPLAY.cyan, for the lit digit
CYAN = "#43ddcd"
FACE = "#000206"        # near-black, so the lit digit has the most to push against

ROOT = Path(__file__).resolve().parent.parent
FONT_DIR = ROOT / "tools" / "fonts"


def fontconfig_env() -> dict:
    """Point fontconfig at the bundled JetBrains Mono without touching the
    system font set."""
    conf = f"""<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>/System/Library/Fonts</dir>
  <dir>/Library/Fonts</dir>
  <dir>{FONT_DIR}</dir>
  <cachedir>{tempfile.gettempdir()}/countdown-fc-cache</cachedir>
</fontconfig>
"""
    path = Path(tempfile.gettempdir()) / "countdown-fonts.conf"
    path.write_text(conf)
    return {**os.environ, "FONTCONFIG_FILE": str(path)}


def svg(scale: float) -> str:
    """scale is the motif's share of the 512 canvas. Below 1 it leaves a
    margin for the maskable icon, whose corners a launcher may crop."""
    C = 512
    win_w, win_h, gap = 150, 188, 16
    win_w, win_h, gap = (v * scale for v in (win_w, win_h, gap))
    block_w = 3 * win_w + 2 * gap
    x0 = (C - block_w) / 2
    y0 = (C - win_h) / 2
    r = 18 * scale
    bw = 4.0 * scale
    inset = bw / 2

    windows = []
    for i, digit in enumerate(TARGET):
        x = x0 + i * (win_w + gap)
        cx = x + win_w / 2
        windows.append(f'''
    <g>
      <!-- Recessed face. A dark drop-shadow lifts it off the gradient; the
           bright inner top edge is the bevel that makes it read as glass. -->
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="{FACE}" filter="url(#lift)"/>
      <rect x="{x + inset:.1f}" y="{y0 + inset:.1f}"
            width="{win_w - bw:.1f}" height="{win_h - bw:.1f}"
            rx="{r - inset:.1f}" fill="none"
            stroke="rgba(255,255,255,0.40)" stroke-width="{bw:.2f}"/>
      <rect x="{x + inset:.1f}" y="{y0 + inset:.1f}"
            width="{win_w - bw:.1f}" height="{win_h * 0.5:.1f}"
            rx="{r - inset:.1f}" fill="url(#bevel)"/>
      <text x="{cx:.1f}" y="{y0 + win_h / 2 + 2 * scale:.1f}" fill="{CYAN_HI}"
            font-family="JetBrains Mono" font-weight="700"
            font-size="{win_w:.0f}" text-anchor="middle"
            dominant-baseline="central" filter="url(#bloom)">{digit}</text>
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="url(#lip)"/>
    </g>''')

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-12%" r="145%">
      <stop offset="0%"  stop-color="{BG_LOW}"/>
      <stop offset="45%" stop-color="{BG_MID}"/>
      <stop offset="100%" stop-color="{BG}"/>
    </radialGradient>
    <!-- Soft cyan halo behind the whole block, so the motif reads as lit. -->
    <radialGradient id="halo" cx="50%" cy="42%" r="46%">
      <stop offset="0%"  stop-color="{CYAN}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="{CYAN}" stop-opacity="0"/>
    </radialGradient>
    <!-- Bevel highlight down the top half of each window. -->
    <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <!-- The reel lip fade from src/components/SlotNumber.jsx, softened so it
         frames the digit without dimming it. -->
    <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(6,9,16,0.85)"/>
      <stop offset="22%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="78%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="100%" stop-color="rgba(6,9,16,0.85)"/>
    </linearGradient>
    <filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="5" stdDeviation="9" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
    <!-- Cyan bloom behind the digit, the glow the app gives the target. -->
    <filter id="bloom" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="b"/>
      <feFlood flood-color="{CYAN_HI}" flood-opacity="0.62"/>
      <feComposite in2="b" operator="in" result="glow"/>
      <feMerge>
        <feMergeNode in="glow"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <rect width="{C}" height="{C}" fill="url(#bg)"/>
  <ellipse cx="{C / 2}" cy="{y0 + win_h / 2:.1f}"
           rx="{block_w / 2 * 1.30:.1f}" ry="{win_h / 2 * 1.40:.1f}" fill="url(#halo)"/>
  {"".join(windows)}
</svg>'''


def render(svg_text: str, out: Path, size: int, env: dict):
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out)],
        input=svg_text.encode(), check=True, env=env,
    )
    print(f"  {out}  {size}x{size}")


def main():
    env = fontconfig_env()
    pub = ROOT / "public"
    full = svg(0.94)          # standard icons: motif nearly fills the frame
    maskable = svg(0.80)      # maskable: enlarged, still inside the safe circle

    print("Rendering icons:")
    render(full, pub / "icon-512.png", 512, env)
    render(full, pub / "icon-192.png", 192, env)
    render(full, pub / "icon-180.png", 180, env)
    render(maskable, pub / "icon-maskable-512.png", 512, env)

    (ROOT / "tools" / "icon.svg").write_text(full)
    (ROOT / "tools" / "icon-maskable.svg").write_text(maskable)


if __name__ == "__main__":
    main()
