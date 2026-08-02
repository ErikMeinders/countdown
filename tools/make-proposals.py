#!/usr/bin/env python3
"""Generate three app-icon proposals from the Countdown design language.

The current icon (make-icons.py) is the target-spinner motif at rest — three
recessed reel windows showing "952". These proposals keep the same brand but
push it to be more attractive as an iPhone home-screen icon:

  1  Lit Reels  —  the same three windows, but bigger and brighter: stronger
     cyan bloom, a richer background and a soft halo, so the hero motif pops
     instead of sitting quiet.
  2  Countdown Ring — a bold circular timer ring swept cyan→amber→ember (the
     urgency ramp as time drains), with the target glowing in the middle.
  3  Wordmark — a bright teal lockup: the COUNTDOWN wordmark over a white
     target badge. The light one, so it stands out among dark app icons.

All text is rendered in the bundled JetBrains Mono Bold (tools/fonts), the same
display face the app uses, via the same fontconfig shim as make-icons.py.

Run from the repo root: python3 tools/make-proposals.py
"""

import os
import subprocess
import tempfile
from pathlib import Path

TARGET = "952"

# Palette, lifted from src/theme.js (DISPLAY + the dark/light accents).
CYAN_HI = "#5ce8da"   # accentHi, brighter than DISPLAY.cyan
CYAN = "#43ddcd"
GOLD = "#f4d46f"
AMBER = "#e8b04b"
EMBER = "#e2603f"
BG_LOW, BG_MID, BG = "#18233c", "#0c1220", "#080a12"
FACE = "#000206"       # near-black reel face, so the lit digit pushes hardest
ON_ACCENT = "#08101a"  # dark navy text that reads on bright surfaces
TEAL_HI, TEAL_LO = "#5ce8da", "#17a89a"  # bright background for the light icon

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


# ── shared defs ──────────────────────────────────────────────────
def defs_glow(name, color, opacity=0.6, std=9):
    return f"""<filter id="{name}" x="-70%" y="-70%" width="240%" height="240%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="{std}" result="b"/>
  <feFlood flood-color="{color}" flood-opacity="{opacity}"/>
  <feComposite in2="b" operator="in" result="glow"/>
  <feMerge>
    <feMergeNode in="glow"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>"""


def defs_lift():
    return f"""<filter id="lift" x="-30%" y="-30%" width="160%" height="160%">
  <feDropShadow dx="0" dy="5" stdDeviation="9" flood-color="#000000" flood-opacity="0.7"/>
</filter>"""


# ── proposal 1: Lit Reels ────────────────────────────────────────
def svg_reels() -> str:
    C = 512
    win_w, win_h, gap = 150, 188, 16
    block_w = 3 * win_w + 2 * gap
    x0 = (C - block_w) / 2
    y0 = (C - win_h) / 2
    r = 18
    bw = 4.0
    inset = bw / 2
    cx = (C - block_w) / 2 + win_w / 2  # first window centre x

    windows = []
    for i, digit in enumerate(TARGET):
        x = x0 + i * (win_w + gap)
        wcx = x + win_w / 2
        windows.append(f"""
    <g>
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="{FACE}" filter="url(#lift)"/>
      <rect x="{x + inset:.1f}" y="{y0 + inset:.1f}"
            width="{win_w - bw:.1f}" height="{win_h - bw:.1f}"
            rx="{r - inset:.1f}" fill="none"
            stroke="rgba(255,255,255,0.40)" stroke-width="{bw:.2f}"/>
      <rect x="{x + inset:.1f}" y="{y0 + inset:.1f}"
            width="{win_w - bw:.1f}" height="{win_h * 0.5:.1f}"
            rx="{r - inset:.1f}" fill="url(#bevel)"/>
      <text x="{wcx:.1f}" y="{y0 + win_h / 2 + 2:.1f}" fill="{CYAN_HI}"
            font-family="JetBrains Mono" font-weight="700"
            font-size="{150:.0f}" text-anchor="middle"
            dominant-baseline="central" filter="url(#bloom)">{digit}</text>
      <rect x="{x:.1f}" y="{y0:.1f}" width="{win_w:.1f}" height="{win_h:.1f}"
            rx="{r:.1f}" fill="url(#lip)"/>
    </g>""")

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-12%" r="145%">
      <stop offset="0%"  stop-color="{BG_LOW}"/>
      <stop offset="45%" stop-color="{BG_MID}"/>
      <stop offset="100%" stop-color="{BG}"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="42%" r="46%">
      <stop offset="0%"  stop-color="{CYAN}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="{CYAN}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="bevel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(255,255,255,0.12)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(6,9,16,0.85)"/>
      <stop offset="22%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="78%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="100%" stop-color="rgba(6,9,16,0.85)"/>
    </linearGradient>
    {defs_lift()}
    {defs_glow("bloom", CYAN_HI, 0.62, 10)}
  </defs>
  <rect width="{C}" height="{C}" fill="url(#bg)"/>
  <ellipse cx="{C / 2}" cy="{y0 + win_h / 2:.1f}"
           rx="{block_w / 2 * 1.30:.1f}" ry="{win_h / 2 * 1.40:.1f}" fill="url(#halo)"/>
  {"".join(windows)}
</svg>"""


# ── proposal 2: Countdown Ring ───────────────────────────────────
def svg_ring() -> str:
    C = 512
    cx = cy = C / 2
    r = 172
    sw = 36
    digit = 132

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-12%" r="145%">
      <stop offset="0%"  stop-color="{BG_LOW}"/>
      <stop offset="45%" stop-color="{BG_MID}"/>
      <stop offset="100%" stop-color="{BG}"/>
    </radialGradient>
    <radialGradient id="ringhalo" cx="50%" cy="50%" r="52%">
      <stop offset="0%"  stop-color="{GOLD}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="{CYAN_HI}"/>
      <stop offset="52%"  stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="{EMBER}"/>
    </linearGradient>
    <linearGradient id="lip" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="rgba(6,9,16,0.85)"/>
      <stop offset="22%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="78%" stop-color="rgba(6,9,16,0)"/>
      <stop offset="100%" stop-color="rgba(6,9,16,0.85)"/>
    </linearGradient>
    {defs_glow("bloom", CYAN_HI, 0.62, 10)}
    {defs_lift()}
    <filter id="ringlift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <rect width="{C}" height="{C}" fill="url(#bg)"/>
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="url(#ringhalo)" stroke-width="{sw + 22}"/>
  <!-- The ring: a full sweep, broken at the top by a dark notch so it reads
       as a running countdown rather than a closed loop. -->
  <circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="url(#ringGrad)"
          stroke-width="{sw}" stroke-linecap="round" filter="url(#ringlift)"/>
  <rect x="{cx - 20}" y="{cy - r - sw / 2 - 1}" width="40" height="{sw + 4}"
        rx="8" fill="{BG}"/>
  <!-- Recessed face behind the target. -->
  <rect x="{cx - 108}" y="{cy - 84}" width="216" height="168" rx="26"
        fill="{FACE}" filter="url(#lift)"/>
  <rect x="{cx - 108}" y="{cy - 84}" width="216" height="168" rx="26"
        fill="url(#lip)"/>
  <text x="{cx}" y="{cy + 2}" fill="{CYAN_HI}" font-family="JetBrains Mono"
        font-weight="700" font-size="{digit}" text-anchor="middle"
        dominant-baseline="central" filter="url(#bloom)">{TARGET}</text>
</svg>"""


# ── proposal 3: Wordmark ─────────────────────────────────────────
def svg_wordmark() -> str:
    C = 512
    word = "COUNTDOWN"
    word_y = 200
    word_size = 76
    badge_w, badge_h = 236, 176
    badge_x = (C - badge_w) / 2
    badge_y = 268
    badge_r = 30
    digit_size = 108

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{C}" height="{C}" viewBox="0 0 {C} {C}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-20%" r="150%">
      <stop offset="0%"  stop-color="{TEAL_HI}"/>
      <stop offset="60%" stop-color="#2fc4b8"/>
      <stop offset="100%" stop-color="{TEAL_LO}"/>
    </radialGradient>
    <filter id="badgeLift" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#06332e"
                    flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="{C}" height="{C}" fill="url(#bg)"/>
  <text x="{C / 2}" y="{word_y}" fill="{ON_ACCENT}"
        font-family="JetBrains Mono" font-weight="700"
        font-size="{word_size}" text-anchor="middle"
        dominant-baseline="central" letter-spacing="0.04em">{word}</text>
  <g filter="url(#badgeLift)">
    <rect x="{badge_x:.1f}" y="{badge_y:.1f}" width="{badge_w:.1f}" height="{badge_h:.1f}"
          rx="{badge_r:.1f}" fill="#f2faf8"/>
  </g>
  <text x="{C / 2}" y="{badge_y + badge_h / 2 + 2:.1f}" fill="{TEAL_LO}"
        font-family="JetBrains Mono" font-weight="700"
        font-size="{digit_size}" text-anchor="middle"
        dominant-baseline="central">{TARGET}</text>
</svg>"""


def render(svg_text: str, out: Path, size: int, env: dict):
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), "-o", str(out)],
        input=svg_text.encode(), check=True, env=env,
    )
    print(f"  {out}  {size}x{size}")


def main():
    env = fontconfig_env()
    pub = ROOT / "public"
    tools = ROOT / "tools"

    proposals = [
        ("icon-proposal-1.png", "proposal-1.svg", svg_reels()),
        ("icon-proposal-2.png", "proposal-2.svg", svg_ring()),
        ("icon-proposal-3.png", "proposal-3.svg", svg_wordmark()),
    ]

    print("Rendering icon proposals:")
    for png, svgname, svg_text in proposals:
        render(svg_text, pub / png, 512, env)
        (tools / svgname).write_text(svg_text)


if __name__ == "__main__":
    main()
