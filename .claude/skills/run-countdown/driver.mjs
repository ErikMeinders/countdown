#!/usr/bin/env node
// Countdown driver — launch the PWA in a real browser, walk it, screenshot it,
// and measure it.
//
//   node .claude/skills/run-countdown/driver.mjs shots [outDir]
//   node .claude/skills/run-countdown/driver.mjs screen <name> [outDir]
//   node .claude/skills/run-countdown/driver.mjs measure
//
// See SKILL.md for the one-time playwright install. Everything here is driven
// through the UI as a player meets it: no internal imports, no test hooks.

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// ── playwright, from wherever it is ────────────────────────────
// The repo deliberately does not depend on playwright: it is agent tooling,
// not a project dependency, and adding it would slow `npm ci` in CI for
// something CI never runs. So resolve it from a scratch install (PW_DIR),
// falling back to a normal import if someone has it locally after all.
const PW_DIR = process.env.PW_DIR || "/tmp/countdown-driver-deps";
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    chromium = createRequire(`${PW_DIR}/`)("playwright").chromium;
  } catch {
    console.error(
      `playwright not found.\n\n  mkdir -p ${PW_DIR}\n` +
        `  printf 'registry=https://registry.npmjs.org/\\n' > ${PW_DIR}/.npmrc\n` +
        `  (cd ${PW_DIR} && npm i playwright)\n\n` +
        `The .npmrc is not optional — see SKILL.md, Gotchas.`
    );
    process.exit(1);
  }
}

// ── dev server ─────────────────────────────────────────────────
// Vite takes the next free port when 5173 is busy, and it is busy often
// enough (a forgotten `npm run dev`) that hard-coding it wastes a run.
async function findBase() {
  if (process.env.BASE) return process.env.BASE;
  for (const port of [5173, 5174, 5175, 5176]) {
    const url = `http://localhost:${port}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(700) });
      const html = await res.text();
      if (html.includes("countdown") || html.includes("main.jsx")) return url;
    } catch {
      /* not this one */
    }
  }
  console.error("No Vite dev server found on 5173-5176. Run `npm run dev` first.");
  process.exit(1);
}

const VIEWPORT = { width: 402, height: 874 }; // iPhone 16 Pro-ish; this is a phone app

// The cached ms-playwright browsers on a dev machine are routinely a different
// build than the installed playwright package expects, and `npx playwright
// install` is a 100MB+ download to fix something Chrome already does.
const launch = () => chromium.launch({ channel: "chrome" });

// Fail loudly. A selector that silently matches nothing produces a clean run
// with no screenshots, which reads as success — that exact bug cost a full
// capture pass while writing this.
async function must(locator, what) {
  if ((await locator.count()) === 0) throw new Error(`no element for: ${what}`);
  return locator.first();
}

async function open(browser, scheme, url = "/", base) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    colorScheme: scheme,
    // The app reads prefers-reduced-motion at module load: SWAP_MS drops to 0
    // and the round starts without the 6-second tile deal and reel spin. That
    // makes shots deterministic *and* fast — see Gotchas before removing it.
    reducedMotion: "reduce",
  });
  // Pin the theme instead of clicking the toggle, which cycles auto->light->dark.
  await ctx.addInitScript((s) => {
    localStorage.setItem("countdown-theme", s);
    localStorage.setItem("countdown-name", "Erik");
  }, scheme);
  const page = await ctx.newPage();
  await page.goto(base + url, { waitUntil: "networkidle" });
  return { ctx, page };
}

async function shoot(page, outDir, name) {
  await page.waitForTimeout(300);
  const path = resolve(outDir, `${name}.png`);
  await page.screenshot({ path });
  console.log("shot", path);
}

// ── flows ──────────────────────────────────────────────────────
// Button labels are uppercased in CSS, and innerText returns the *transformed*
// text, so every matcher here is case-insensitive on purpose.

async function localFlow(browser, scheme, outDir, base) {
  const { ctx, page } = await open(browser, scheme, "/", base);
  await shoot(page, outDir, `${scheme}-1-setup`);

  await (await must(page.locator("button", { hasText: /single/i }), "Single button")).click();
  await page.waitForTimeout(600);
  await shoot(page, outDir, `${scheme}-2-play`);

  // Build one step, so the working area isn't empty in the shot.
  const tiles = page.locator("button").filter({ hasText: /^\d+$/ });
  if ((await tiles.count()) >= 2) {
    await tiles.nth(0).click();
    const plus = page.locator("button", { hasText: /^[+＋]$/ });
    if (await plus.count()) await plus.first().click();
    await tiles.nth(1).click();
    await shoot(page, outDir, `${scheme}-3-working`);
  }

  await (await must(page.locator("button", { hasText: /^submit$/i }), "Submit")).click();
  await page.waitForTimeout(1200); // the solver runs 30ms after the round ends
  await shoot(page, outDir, `${scheme}-4-result`);
  await ctx.close();
}

async function mpFlow(browser, scheme, outDir, base) {
  // ?mock=1 is dev-only and drives a scripted opponent, so the whole room
  // flow works with no backend and no second device.
  const { ctx, page } = await open(browser, scheme, "/?mock=1", base);
  await (await must(page.locator("button", { hasText: /together/i }), "Together")).click();
  await page.waitForTimeout(600);
  await shoot(page, outDir, `${scheme}-5-mp-landing`);

  await (await must(page.locator("button", { hasText: /create/i }), "Create room")).click();
  await page.waitForTimeout(900);
  const go = page.locator("button", { hasText: /create|continue|next/i });
  if (await go.count()) {
    await go.first().click();
    await page.waitForTimeout(1500);
  }
  await shoot(page, outDir, `${scheme}-6-mp-lobby`);

  await (await must(page.locator("button", { hasText: /ready/i }), "I'm ready")).click();
  await page.waitForTimeout(4000); // mock opponent readies, then the round starts
  await shoot(page, outDir, `${scheme}-7-mp-round`);
  await ctx.close();
}

// ── measure ────────────────────────────────────────────────────
// Turns "the type looks inconsistent" into a count. Design drift is far easier
// to see as a list of computed values than in a screenshot.
async function measure(browser, base) {
  for (const [label, url, drive] of [
    ["SETUP", "/", null],
    [
      "MP LOBBY",
      "/?mock=1",
      async (page) => {
        await page.locator("button", { hasText: /together/i }).first().click();
        await page.waitForTimeout(500);
        const c = page.locator("button", { hasText: /create/i });
        if (await c.count()) {
          await c.first().click();
          await page.waitForTimeout(700);
        }
        const go = page.locator("button", { hasText: /create|continue|next/i });
        if (await go.count()) {
          await go.first().click();
          await page.waitForTimeout(1500);
        }
      },
    ],
  ]) {
    const { ctx, page } = await open(browser, "dark", url, base);
    if (drive) await drive(page);
    const rows = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("button, h1, p, span, div")) {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const text = (el.innerText || "").trim().split("\n")[0].slice(0, 18);
        const isBtn = el.tagName === "BUTTON";
        if (!isBtn && (!text || el.children.length)) continue; // leaf text only
        const cs = getComputedStyle(el);
        out.push({
          h: Math.round(r.height),
          radius: cs.borderRadius.split(" ")[0],
          size: cs.fontSize,
          weight: cs.fontWeight,
          track: cs.letterSpacing,
          font: cs.fontFamily.split(",")[0].replace(/['"]/g, ""),
          text: (isBtn ? "[btn] " : "") + text,
        });
      }
      return out;
    });
    console.log(`\n===== ${label} =====`);
    for (const r of rows) {
      console.log(
        [
          String(r.h).padStart(4),
          r.radius.padStart(7),
          r.size.padStart(7),
          String(r.weight).padStart(4),
          r.track.padStart(8),
          r.font.padEnd(14),
          r.text,
        ].join(" ")
      );
    }
    console.log(`\n${label} distinct font sizes:`, [...new Set(rows.map((r) => r.size))].join(" "));
    console.log(`${label} distinct tracking:`, [...new Set(rows.map((r) => r.track))].join(" "));
    await ctx.close();
  }
}

// ── main ───────────────────────────────────────────────────────
const [cmd = "shots", ...rest] = process.argv.slice(2);
const base = await findBase();
console.log("dev server:", base);
const browser = await launch();

try {
  if (cmd === "measure") {
    await measure(browser, base);
  } else if (cmd === "shots") {
    const outDir = resolve(rest[0] || "shots");
    mkdirSync(outDir, { recursive: true });
    for (const scheme of ["dark", "light"]) {
      await localFlow(browser, scheme, outDir, base);
      await mpFlow(browser, scheme, outDir, base);
    }
    console.log("\ndone ->", outDir);
  } else if (cmd === "screen") {
    const name = rest[0];
    const outDir = resolve(rest[1] || "shots");
    mkdirSync(outDir, { recursive: true });
    const scheme = process.env.THEME || "dark";
    if (name === "setup") {
      const { page } = await open(browser, scheme, "/", base);
      await shoot(page, outDir, `${scheme}-setup`);
    } else if (name === "play" || name === "result") {
      await localFlow(browser, scheme, outDir, base);
    } else if (name === "mp") {
      await mpFlow(browser, scheme, outDir, base);
    } else {
      throw new Error(`unknown screen: ${name} (setup | play | result | mp)`);
    }
  } else {
    throw new Error(`unknown command: ${cmd} (shots | screen | measure)`);
  }
} finally {
  await browser.close();
}
