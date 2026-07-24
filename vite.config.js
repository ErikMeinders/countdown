import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Files that exist to be served but never need to be played offline.
const NOT_PRECACHED = new Set(["sw.js", ".nojekyll", "icon-maskable-512.png"]);

function filesIn(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? filesIn(join(dir, e.name), root)
      : [relative(root, join(dir, e.name))]
  );
}

// Writes dist/sw.js from src/sw-template.js with the real build output in it.
//
// The old hand-written worker listed a fixed "./app.js" and a CACHE constant
// you had to remember to bump; forget it once and every installed copy keeps
// serving the previous version forever. Here the precache list is read off the
// finished dist/ and the cache name is a hash of those files' contents, so a
// changed build always invalidates and an unchanged one never does.
function serviceWorker() {
  return {
    name: "countdown-service-worker",
    apply: "build",
    closeBundle() {
      const outDir = "dist";
      const files = filesIn(outDir)
        .filter((f) => !NOT_PRECACHED.has(f))
        .sort();

      const hash = createHash("sha256");
      for (const f of files) {
        hash.update(f).update(readFileSync(join(outDir, f)));
      }
      const fingerprint = hash.digest("hex").slice(0, 12);

      // "./" is the URL the home-screen icon actually opens; the rest are
      // what that page goes on to request.
      const assets = ["./", ...files.map((f) => `./${f.split("\\").join("/")}`)];

      const source = readFileSync("src/sw-template.js", "utf8")
        .replace("%CACHE%", `countdown-${fingerprint}`)
        .replace("%ASSETS%", JSON.stringify(assets, null, 2));

      writeFileSync(join(outDir, "sw.js"), source);
    },
  };
}

export default defineConfig({
  // Relative, so the same build works at github.io/countdown/, at a domain
  // root, and from file://. Switch this to an absolute path and Pages breaks.
  base: "./",
  plugins: [react(), serviceWorker()],
  build: {
    outDir: "dist",
    // The bundle is ~440 KB because Tone.js is in it. That is expected and
    // it is cached after first load; don't let the warning imply otherwise.
    chunkSizeWarningLimit: 600,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.{js,jsx}"],
  },
});
