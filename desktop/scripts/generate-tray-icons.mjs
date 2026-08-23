#!/usr/bin/env node
//
// generate-tray-icons.mjs — Render the system-tray icons (16/32/64 px) from
// tray-icon-source.svg using @resvg/resvg-js.
//
// This is the Windows-friendly counterpart to generate-icons.sh's tray step
// (which requires rsvg-convert / librsvg). Resvg is a pure Rust → WASM SVG
// renderer, so it works on any platform Node.js runs on without native
// compilation. Keep the output byte-for-byte compatible with the shell
// script's output contract: build/tray-icons/{16,32,64}x{16,32,64}.png.
//
// Usage:  pnpm --dir desktop exec node scripts/generate-tray-icons.mjs

import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = join(SCRIPT_DIR, "..", "build");
const SVG_PATH = join(BUILD_DIR, "tray-icon-source.svg");
const OUT_DIR = join(BUILD_DIR, "tray-icons");

const svg = readFileSync(SVG_PATH, "utf8");

for (const size of [16, 32, 64]) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  });
  const png = resvg.render().asPng();
  const out = join(OUT_DIR, `${size}x${size}.png`);
  writeFileSync(out, png);
  console.log(`[OK] ${out} (${png.length} bytes)`);
}
