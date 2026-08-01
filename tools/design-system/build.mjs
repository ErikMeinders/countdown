// Build the Claude Design system bundle from the real tokens.
//
// Every card here is rendered from src/theme.js and src/styles.js — the same
// palette objects and the same style factories the app renders with. Nothing is
// transcribed by hand, so the design system cannot quietly drift from the app:
// change a token, re-run this, push. That is the same bargain as the service
// worker in vite.config.js, which is generated from the finished build rather
// than maintained alongside it.
//
//   node tools/design-system/build.mjs [outDir]     # default: tools/design-system/out
//
// Push it with the DesignSync tool (see SKILL.md in .claude/skills/, or ask
// Claude to "sync the design system").

import { cpSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DISPLAY, PALETTES, urgencyColor } from "../../src/theme.js";
import {
  REEL_BASE_MS, REEL_CELL, REEL_CELLS, REEL_EASE, REEL_LOOPS,
  REEL_STAGGER_MS, REEL_STEP_MS, REEL_TRAVEL, REEL_WIDTH,
  reelDuration, reelLanding,
} from "../../src/reels.js";
import {
  reelFaceStyle,
  reelGlow,
  reelLipStyle,
  reelWellStyle,
} from "../../src/components/reelStyles.js";
import {
  filledRowBtn,
  iconBtn,
  labelStyle,
  numBadge,
  panelStyle,
  primaryBtn,
  secondaryBtn,
  segmentedBox,
  segmentedItem,
  tertiaryBtn,
} from "../../src/styles.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT = resolve(process.argv[2] || `${HERE}/out`);

// ── React style object -> CSS ──────────────────────────────────
// The app styles inline, so the factories return camelCased objects with bare
// numbers. These are the only properties in use where a bare number is not px.
const UNITLESS = new Set(["fontWeight", "opacity", "flex", "lineHeight", "zIndex"]);

function toCss(style) {
  return Object.entries(style)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      const val = typeof v === "number" && !UNITLESS.has(k) ? `${v}px` : v;
      return `${prop}:${val}`;
    })
    .join(";");
}

const el = (tag, style, content = "", attrs = "") =>
  `<${tag} style="${toCss(style)}" ${attrs}>${content}</${tag}>`;

// ── page chrome ────────────────────────────────────────────────
// Cards are indexed from the first-line @dsCard marker.
function page({ group, name, subtitle, body, width = 880 }) {
  return `<!-- @dsCard group="${group}" name="${name}" subtitle="${subtitle}" -->
<!doctype html>
<meta charset="utf-8">
<title>${name}</title>
<style>
  @font-face{font-family:'Outfit';src:url('assets/fonts/outfit-300.woff2') format('woff2');font-weight:300;font-display:block}
  @font-face{font-family:'Outfit';src:url('assets/fonts/outfit-500.woff2') format('woff2');font-weight:500;font-display:block}
  @font-face{font-family:'Outfit';src:url('assets/fonts/outfit-700.woff2') format('woff2');font-weight:700;font-display:block}
  @font-face{font-family:'Outfit';src:url('assets/fonts/outfit-900.woff2') format('woff2');font-weight:900;font-display:block}
  @font-face{font-family:'JetBrains Mono';src:url('assets/fonts/jetbrains-mono-400.woff2') format('woff2');font-weight:400;font-display:block}
  @font-face{font-family:'JetBrains Mono';src:url('assets/fonts/jetbrains-mono-500.woff2') format('woff2');font-weight:500;font-display:block}
  @font-face{font-family:'JetBrains Mono';src:url('assets/fonts/jetbrains-mono-700.woff2') format('woff2');font-weight:700;font-display:block}
  *{box-sizing:border-box}
  /* Full height on both, or a card whose content is shorter than the viewport
     shows a white band under the two panes. */
  html,body{height:100%}
  body{margin:0;font-family:'Outfit',system-ui,sans-serif;display:grid;grid-template-columns:1fr 1fr;width:${width}px}
  .pane{padding:28px 24px 32px}
  .pane-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 20px;opacity:.75}
  .row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:18px}
  .note{font-family:'JetBrains Mono',monospace;font-size:10px;line-height:1.7;opacity:.65;margin:14px 0 0}
  .swatch{width:100%;height:44px;border-radius:6px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .cap{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.06em;margin-top:5px;opacity:.7;word-break:break-all}
</style>
${body}
`;
}

// One card, rendered once per palette so light and dark sit side by side —
// the pairing is the review: a component that only works in one of them is
// obvious here and invisible in the app.
function bothThemes({ group, name, subtitle, render, width }) {
  const panes = ["dark", "light"]
    .map((scheme) => {
      const T = PALETTES[scheme];
      return `<div class="pane" style="background:${T.bg};color:${T.text}">
        <p class="pane-label" style="color:${T.muted}">${scheme}</p>
        ${render(T, scheme)}
      </div>`;
    })
    .join("\n");
  return page({ group, name, subtitle, body: panes, width });
}

// ── contrast, so the cards carry their own evidence ────────────
const hex = (h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = (c) => {
  const [r, g, b] = (typeof c === "string" ? hex(c) : c).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const over = (fg, alpha, bg) => hex(bg).map((b, i) => Math.round(fg[i] * alpha + b * (1 - alpha)));
const rgbHex = (c) => `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

// ── cards ──────────────────────────────────────────────────────
const cards = {};

cards["colour.html"] = bothThemes({
  group: "Foundations",
  name: "Colour",
  subtitle: "Both palettes, with measured contrast",
  render: (T) => {
    const swatches = [
      ["cyan", T.cyan],
      ["accentHi", T.accentHi],
      ["accentLo", T.accentLo],
      ["gold", T.gold],
      ["amber", T.amber],
      ["orange", T.orange],
      ["ember", T.ember],
      ["red", T.red],
      ["violet", T.violet],
      ["bg", T.bg],
      ["bgMid", T.bgMid],
      ["bgLow", T.bgLow],
      ["text", T.text],
      ["textDim", T.textDim],
      ["muted", T.muted],
      ["dim", T.dim],
    ];
    const onTint = ratio(T.cyan, rgbHex(over(hex(T.cyan), 0.12, rgbHex(over(hex(T.text), 0.04, T.bg)))));
    return `
      <div class="grid">
        ${swatches
          .map(
            ([n, c]) =>
              `<div><div class="swatch" style="background:${c};border:1px solid ${T.hair}"></div><div class="cap" style="color:${T.muted}">${n}<br>${c}</div></div>`
          )
          .join("")}
      </div>
      <p class="note" style="color:${T.muted}">
        text on bg ${ratio(T.text, T.bg).toFixed(2)}:1 &nbsp;·&nbsp;
        muted on bg ${ratio(T.muted, T.bg).toFixed(2)}:1 &nbsp;·&nbsp;
        accent text on its own tint ${onTint.toFixed(2)}:1<br>
        4.5:1 is the floor for normal text; 3:1 for UI boundaries.
      </p>`;
  },
});

cards["type.html"] = bothThemes({
  group: "Foundations",
  name: "Type scale",
  subtitle: "Five steps, tracking in em",
  render: (T) => {
    const steps = [
      ["xl", T.type.xl, "COUNTDOWN", T.track.brand, 700],
      ["lg", T.type.lg, "Screen title", T.track.ui, 700],
      ["md", T.type.md, "Every control and body line", T.track.ui, 700],
      ["sm", T.type.sm, "Meta and secondary prose", "normal", 400],
      ["xs", T.type.xs, "OVERLINE LABEL", T.track.label, 400],
    ];
    return (
      steps
        .map(
          ([k, size, sample, track, weight]) => `
      <div style="display:flex;align-items:baseline;gap:16px;margin-bottom:14px">
        <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:${T.muted};width:58px;flex:none">${k} ${size}</span>
        <span style="font-size:${size}px;letter-spacing:${track};font-weight:${weight};color:${T.text}">${sample}</span>
      </div>`
        )
        .join("") +
      `<p class="note" style="color:${T.muted}">
        tracking &nbsp; ui ${T.track.ui} &nbsp; label ${T.track.label} &nbsp; brand ${T.track.brand}<br>
        em, not px — so the wordmark is spaced identically at ${T.type.xl}px and ${T.type.md}px.
      </p>`
    );
  },
});

cards["space-radius.html"] = bothThemes({
  group: "Foundations",
  name: "Space & radius",
  subtitle: "4px grid, four radii",
  render: (T) => `
    <div class="row">
      ${Object.entries(T.gap)
        .map(
          ([k, v]) =>
            `<div style="text-align:center"><div style="width:${v}px;height:36px;background:${T.cyan};border-radius:2px"></div><div class="cap" style="color:${T.muted}">${k}<br>${v}</div></div>`
        )
        .join("")}
    </div>
    <div class="row">
      ${Object.entries(T.r)
        .map(
          ([k, v]) =>
            `<div style="text-align:center"><div style="width:56px;height:56px;border:1.5px solid ${T.cyan};border-radius:${v}px"></div><div class="cap" style="color:${T.muted}">${k}<br>${v}</div></div>`
        )
        .join("")}
    </div>
    <p class="note" style="color:${T.muted}">control ${T.control}px — the icon-only tap target.</p>`,
});

cards["urgency.html"] = page({
  group: "Foundations",
  name: "Urgency ramp",
  subtitle: "Clock colour as time drains — never themed",
  width: 880,
  body: `<div class="pane" style="grid-column:1/-1;background:${PALETTES.dark.bg};color:${DISPLAY.text}">
    <p class="pane-label" style="color:${PALETTES.dark.muted}">display — dark in both themes</p>
    <div style="display:flex;gap:2px;margin-bottom:16px">
      ${Array.from({ length: 40 }, (_, i) => {
        const pct = 1 - i / 39;
        return `<div style="flex:1;height:56px;background:${urgencyColor(pct)}"></div>`;
      }).join("")}
    </div>
    <div style="display:flex;justify-content:space-between;font-family:'JetBrains Mono',monospace;font-size:10px;color:${PALETTES.dark.muted}">
      <span>full — ${DISPLAY.cyan}</span><span>50% — warming</span><span>20% — ${DISPLAY.amber}</span><span>0 — ${DISPLAY.ember}</span>
    </div>
    <p class="note" style="color:${PALETTES.dark.muted}">
      The reels are a lit display and stay dark in both palettes, like a real clock face —
      so the ramp reads off DISPLAY, outside the theme, and never needs re-tuning per mode.
    </p>
  </div>`,
});

cards["buttons.html"] = bothThemes({
  group: "Components",
  name: "Buttons",
  subtitle: "Primary / secondary / tertiary / filled row",
  render: (T) => `
    <div class="row">${el("button", primaryBtn(T), "Single")}${el("button", secondaryBtn(T), "Together")}</div>
    <div class="row">${el("button", secondaryBtn(T), "Reset")}${el("button", filledRowBtn(T), "Submit")}${el("button", tertiaryBtn(T), "Cancel")}</div>
    <p class="note" style="color:${T.muted}">
      One type treatment across all four — ${T.type.md}px / 700 / uppercase / ${T.track.ui}.
      What separates them is the fill, not the lettering.
    </p>`,
});

cards["pills.html"] = bothThemes({
  group: "Components",
  name: "Choice pills",
  subtitle: "The setup screen's one control language",
  render: (T) => {
    const pill = (on, label) =>
      el(
        "button",
        {
          flex: 1,
          height: 46,
          padding: "0 8px",
          borderRadius: T.r.md,
          border: `1.5px solid ${on ? T.cyan : T.hair}`,
          background: on ? T.cyanDim : "transparent",
          color: on ? T.cyan : T.mutedLight,
          fontFamily: T.sans,
          fontSize: T.type.md,
          fontWeight: on ? 700 : 500,
        },
        label
      );
    return `
      <div style="${toCss({ ...labelStyle(T), textAlign: "center" })}">Round length</div>
      <div style="display:flex;gap:${T.gap.sm}px;margin-bottom:20px">${pill(false, "30s")}${pill(true, "45s")}${pill(false, "60s")}</div>
      <div style="${toCss({ ...labelStyle(T), textAlign: "center" })}">Target</div>
      <div style="display:flex;gap:${T.gap.sm}px">${pill(true, "Authentic")}${pill(false, "Solvable")}</div>`;
  },
});

cards["segmented-badges.html"] = bothThemes({
  group: "Components",
  name: "Segmented & badges",
  subtitle: "One-of-N switch, number tokens",
  render: (T) => `
    <div style="${toCss(segmentedBox(T))};margin-bottom:22px">
      ${el("button", segmentedItem(T, true), "Authentic")}${el("button", segmentedItem(T, false), "Solvable")}
    </div>
    <div class="row">
      ${el("span", numBadge(T, false), "75")}${el("span", numBadge(T, false), "10")}
      <span style="color:${T.muted};font-family:${T.mono}">+</span>
      ${el("span", numBadge(T, true), "102")}
    </div>
    <p class="note" style="color:${T.muted}">
      Cyan is a source tile, amber a calculated one. Both are text on their own tint —
      the case the light palette is tuned against.
    </p>`,
});

cards["panel-icons.html"] = bothThemes({
  group: "Components",
  name: "Panel & icon buttons",
  subtitle: "Lit surfaces, 36px controls",
  render: (T) => `
    <div style="${toCss(panelStyle(T))};margin-bottom:20px">
      <div style="${toCss(labelStyle(T))}">Players</div>
      <div style="font-family:${T.sans};font-size:${T.type.md}px;color:${T.text}">Erik <span style="color:${T.muted};font-size:${T.type.sm}px">(you) · host</span></div>
    </div>
    <div class="row">
      ${el("button", iconBtn(T), `<svg width="17" height="17" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" fill="${T.mutedLight}"/></svg>`)}
      ${el("button", iconBtn(T), `<svg width="17" height="17" viewBox="0 0 24 24"><path d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z" fill="${T.mutedLight}" stroke="${T.mutedLight}" stroke-width="1.6" stroke-linejoin="round"/></svg>`)}
    </div>
    <p class="note" style="color:${T.muted}">
      Panels carry an inset hairline along the top edge, so a flat scheme still reads as lit.
    </p>`,
});

// The reels are the one surface that does not theme, so this card is built the
// other way round from the rest: the same display on both palettes, to show
// that it does *not* change. If a future edit makes it follow the theme, the
// two halves of this card stop matching and it's obvious at a glance.
cards["reels.html"] = bothThemes({
  group: "Foundations",
  name: "Reels",
  subtitle: "The lit display — identical in both themes",
  render: (T) => {
    const face = (d, color, size = 50) =>
      `<div style="${toCss({ ...reelFaceStyle, position: "relative", overflow: "hidden", height: REEL_CELL, width: REEL_WIDTH })}">
         <div style="height:${REEL_CELL}px;line-height:${REEL_CELL}px;text-align:center;font-family:${DISPLAY.mono};font-size:${size}px;font-weight:700;color:${color};text-shadow:${reelGlow(color)}">${d}</div>
         <div style="${toCss(reelLipStyle)}"></div>
       </div>`;
    const well = (digits, color) =>
      `<div style="${toCss(reelWellStyle)}">${digits
        .split("")
        .map((d) => face(d, color))
        .join("")}</div>`;

    return `
      <div style="margin-bottom:18px">${well("812", DISPLAY.text)}</div>
      <div class="row" style="gap:8px">
        ${["8", "1", "2"].map((d, i) => face(d, [DISPLAY.cyan, DISPLAY.amber, DISPLAY.ember][i], 34)).join("")}
      </div>
      <p class="note" style="color:${T.muted}">
        cell ${REEL_CELL} × ${REEL_WIDTH} &nbsp;·&nbsp; ${REEL_LOOPS} loops = ${REEL_CELLS} cells past the window<br>
        stagger ${REEL_STAGGER_MS}ms &nbsp;·&nbsp; ${reelDuration(0)}–${reelDuration(2)}ms
        (${REEL_BASE_MS} + ${REEL_STEP_MS} per reel) &nbsp;·&nbsp; travel ${Math.round(REEL_TRAVEL * 100)}%<br>
        ease cubic-bezier(${REEL_EASE.join(", ")}) &nbsp;·&nbsp; last reel lands at ${reelLanding(2).toFixed(2)}s<br>
        Each cell boundary crossing the window is one click of the rattle — sound and
        animation are derived from the same numbers, not kept in step by hand.
      </p>`;
  },
});

cards["wordmark.html"] = bothThemes({
  group: "Brand",
  name: "Wordmark",
  subtitle: "One mark, two sizes, one em tracking",
  render: (T) => {
    const mark = (size) =>
      `<div style="font-family:${T.sans};font-size:${size}px;font-weight:700;letter-spacing:${T.track.brand};text-indent:0.14em;color:${T.text};opacity:.92;white-space:nowrap">COUNTDOWN</div>`;
    return `${mark(T.type.xl)}<div style="height:18px"></div>${mark(T.type.md)}
      <p class="note" style="color:${T.muted}">
        The small size steps back once you're in a room. Tracking is ${T.track.brand} at both,
        which is what makes it the same mark rather than the same word.
      </p>`;
  },
});

// ── write ──────────────────────────────────────────────────────
mkdirSync(`${OUT}/assets/fonts`, { recursive: true });
for (const [name, html] of Object.entries(cards)) {
  writeFileSync(`${OUT}/${name}`, html);
}
for (const f of readdirSync(`${ROOT}/public/fonts`).filter((f) => f.endsWith(".woff2"))) {
  cpSync(`${ROOT}/public/fonts/${f}`, `${OUT}/assets/fonts/${f}`);
}

console.log(`${Object.keys(cards).length} cards -> ${OUT}`);
for (const n of Object.keys(cards)) console.log("  ", n);
