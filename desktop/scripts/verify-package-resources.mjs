#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";

const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const DESKTOP_DIR = resolve(SCRIPT_DIR, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");

const GATEWAY_DIR = join(DESKTOP_DIR, "resources", "gateway");
const FRONTEND_DIR = join(REPO_ROOT, "frontend");
const FRONTEND_OUT_DIR = join(FRONTEND_DIR, "out");
const BACKEND_DIR = join(REPO_ROOT, "qilin");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const BACKEND_BUILD_DIR = join(DESKTOP_DIR, "backend-build");
const SPEC_FILE = join(BACKEND_BUILD_DIR, "kworks-gateway.spec");

// `--source-only` skips the PyInstaller / Next.js build artifacts and instead
// validates the *source contract*: every file the spec collects as `datas` and
// every config the desktop frontend build needs must be present and correct in
// the source tree. This lets `release.sh` run a fast pre-tag check without
// paying the multi-minute PyInstaller cost on every release — the full artifact
// verification still runs in CI (release-desktop.yml) and in
// `pnpm run build:app` (which builds the gateway before verifying).
const SOURCE_ONLY = process.argv.includes("--source-only");

const checks = [];

function pass(label) {
  checks.push({ label, ok: true });
}

function fail(label, detail) {
  checks.push({ label, ok: false, detail });
}

function requirePath(path, label) {
  if (!existsSync(path)) {
    fail(label, `Missing: ${path}`);
    return false;
  }
  pass(label);
  return true;
}

function requireFileContains(path, label, patterns) {
  if (!requirePath(path, label)) return;
  const contents = readFileSync(path, "utf8");
  for (const pattern of patterns) {
    if (!contents.includes(pattern)) {
      fail(`${label} contains ${pattern}`, `Expected marker not found in ${path}`);
      return;
    }
  }
  pass(`${label} contains required markers`);
}

function requireExecutable(path, label) {
  if (!requirePath(path, label)) return;
  const mode = statSync(path).mode;
  if (process.platform !== "win32" && (mode & 0o111) === 0) {
    fail(label, `Not executable: ${path}`);
    return;
  }
  pass(`${label} is executable`);
}

function gatewayExecutablePath() {
  return join(
    GATEWAY_DIR,
    process.platform === "win32" ? "kworks-gateway.exe" : "kworks-gateway",
  );
}

// ── Source-contract checks ────────────────────────────────────────────────
// If these pass, a subsequent `pnpm run build:gateway` + `build:frontend`
// will produce a bundle that satisfies the product-mode checks below.
function runSourceChecks() {
  // PyInstaller spec + entrypoint exist.
  requirePath(SPEC_FILE, "source spec kworks-gateway.spec");
  requirePath(join(BACKEND_DIR, "app", "gateway", "app.py"), "source backend gateway app.py");

  // Spec must still wire the critical datas; catches accidental edits that
  // would silently drop skills / config / qilin from the frozen bundle.
  requireFileContains(SPEC_FILE, "spec datas wiring", [
    "skills/public",
    "config.embedded.yaml",
    "qilin",
  ]);

  // config.embedded.yaml source (copied into _internal by the spec).
  requirePath(
    join(BACKEND_BUILD_DIR, "config.embedded.yaml"),
    "source config.embedded.yaml",
  );

  // skills/public source tree — the repo's built-in skill catalog. The
  // desktop seeds ~/.kworks/skills from this tree on first run (the
  // PyInstaller bundle ships it under _internal/skills/public).
  requirePath(join(SKILLS_DIR, "public"), "source skills/public");

  // local_skill_storage.py source — the SkillStorage implementation the
  // desktop gateway uses for builtin/custom skill discovery.
  requireFileContains(
    join(
      BACKEND_DIR,
      "qilin",
      "skills",
      "storage",
      "local_skill_storage.py",
    ),
    "source local_skill_storage.py",
    ["class LocalSkillStorage"],
  );

  // frontend desktop static-export wiring.
  requirePath(join(FRONTEND_DIR, "next.config.js"), "source frontend next.config.js");
  requireFileContains(
    join(FRONTEND_DIR, "next.config.js"),
    "frontend static export config",
    ['output: "export"'],
  );
  requireFileContains(
    join(FRONTEND_DIR, "package.json"),
    "frontend build:desktop script",
    ["build:desktop"],
  );
}

// ── Product checks (require built artifacts) ──────────────────────────────
function runProductChecks() {
  requireExecutable(gatewayExecutablePath(), "resources/gateway executable");
  requirePath(join(FRONTEND_OUT_DIR, "index.html"), "frontend/out index.html");
  requirePath(join(FRONTEND_OUT_DIR, "_next"), "frontend/out _next assets");
  requirePath(
    join(GATEWAY_DIR, "_internal", "config.embedded.yaml"),
    "resources/gateway config.embedded.yaml",
  );
  requirePath(
    join(GATEWAY_DIR, "_internal", "skills", "public"),
    "resources/gateway skills/public",
  );
  requireFileContains(
    join(GATEWAY_DIR, "_internal", "qilin", "skills", "storage", "local_skill_storage.py"),
    "resources/gateway local_skill_storage.py",
    ["class LocalSkillStorage"],
  );
}

if (SOURCE_ONLY) {
  console.log("Mode: source-only (skipping PyInstaller / Next build artifacts)");
  runSourceChecks();
} else {
  console.log("Mode: product (verifying built gateway + frontend artifacts)");
  runProductChecks();
}

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const prefix = check.ok ? "[OK]" : "[FAIL]";
  console.log(`${prefix} ${check.label}`);
  if (!check.ok && check.detail) console.log(`       ${check.detail}`);
}

if (failed.length > 0) {
  console.error(
    `\nPackage resource verification failed: ${failed.length} check(s) failed.`,
  );
  process.exit(1);
}

console.log(
  SOURCE_ONLY
    ? "\nSource contract OK — full artifact verification runs in CI / build:app."
    : "\nPackage resources are ready for electron-builder.",
);
