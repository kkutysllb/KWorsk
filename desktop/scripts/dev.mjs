/**
 * Development launcher for the Electron desktop shell.
 *
 * Boots three processes and wires them together:
 *   1. The Python gateway via `uv run uvicorn` (backend venv)
 *   2. The Next.js dev server on port 28569
 *   3. Electron, pointed at the dev server via KWORKS_DEV_SERVER=1
 *
 * Ctrl-C tears everything down cleanly.
 */

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESKTOP_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(DESKTOP_DIR, "..");
const FRONTEND_DIR = resolve(REPO_ROOT, "frontend");
// The QiLin engine is a git submodule at <repo>/qilin.
const BACKEND_DIR = resolve(REPO_ROOT, "qilin");
const EMBEDDED_CONFIG = resolve(
  REPO_ROOT,
  "desktop",
  "backend-build",
  "config.embedded.yaml",
);

const GATEWAY_PORT = process.env.GATEWAY_PORT ?? "29987";
const DEV_SERVER_PORT = "28569";
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;
const FRONTEND_READY_TIMEOUT_MS = 60_000;
const DESKTOP_DEV_ORIGINS = [
  "app://-",
  `http://127.0.0.1:${DEV_SERVER_PORT}`,
  `http://localhost:${DEV_SERVER_PORT}`,
].join(",");

/** Track child processes so we can tear them down on exit. */
const children = [];
let shuttingDown = false;
let gatewayProcess = null;
let gatewayRestartTimer = null;
let migrateDesktopConfigYaml = null;

// Best-effort log of unexpected dev-launcher exits. Without this, the only
// signal we have when "dev environment disappeared" is whatever happens to
// still be on the user's terminal scrollback — usually nothing, especially
// when the IDE / Terminal.app window was the trigger. Writing to a file
// under ~/.kworks/logs keeps the audit trail next to main.log / renderer.log
// so we can tell SIGTERM (deliberate Cmd+Q) from SIGHUP (terminal window
// closed) after the fact.
const DEV_LOG_DIR =
  process.env.QILIN_LOG_DIR ??
  join(process.env.HOME ?? "", ".kworks", "logs");
const DEV_LOG_PATH = join(DEV_LOG_DIR, "dev-exits.log");

/** Append a single line to the dev-exits log; never throws. */
function appendDevExitLog(line) {
  try {
    mkdirSync(DEV_LOG_DIR, { recursive: true });
    appendFileSync(DEV_LOG_PATH, line, "utf8");
  } catch {
    // A missing ~/.kworks or read-only FS shouldn't kill the launcher.
  }
}

function start(cmd, args, opts = {}) {
  const { onExit, onStdout, onStderr, detached, ...spawnOpts } = opts;
  const child = spawn(cmd, args, {
    stdio: onStdout || onStderr ? ["inherit", "pipe", "pipe"] : "inherit",
    shell: process.platform === "win32",
    // POSIX: put each child in its own process group so teardown can kill the
    // entire group (including grandchildren spawned by pnpm exec / uv run)
    // with a single negative-PID signal. Without this, killing the direct
    // child leaves grandchildren as orphans still bound to ports (e.g. 29987)
    // or holding .next/dev/lock. Windows has no process groups, so disabled.
    detached: process.platform !== "win32" && detached !== false,
    ...spawnOpts,
  });
  if (child.stdout) {
    child.stdout.on("data", (chunk) => {
      process.stdout.write(chunk);
      if (typeof onStdout === "function") {
        onStdout(String(chunk));
      }
    });
  }
  if (child.stderr) {
    child.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
      if (typeof onStderr === "function") {
        onStderr(String(chunk));
      }
    });
  }
  children.push(child);
  child.on("exit", (code, signal) => {
    const childIndex = children.indexOf(child);
    if (childIndex >= 0) {
      children.splice(childIndex, 1);
    }
    if (!shuttingDown) {
      console.log(`[dev] ${cmd} exited (code=${code}, signal=${signal ?? "none"})`);
      // Persist the exit reason so "dev environment disappeared" reports can
      // be diagnosed after the fact. Live console output is usually gone by
      // the time someone investigates, especially on macOS where closing
      // the terminal panel tears everything down with no scrollback.
      appendDevExitLog(
        `${new Date().toISOString()} child cmd=${cmd} pid=${child.pid} ` +
          `code=${code} signal=${signal ?? "none"} args=${JSON.stringify(args)}\n`,
      );
    }
    if (typeof onExit === "function") {
      onExit(code, signal);
    }
  });
  return child;
}

function scheduleGatewayRestart() {
  if (shuttingDown || gatewayRestartTimer) return;
  gatewayRestartTimer = setTimeout(() => {
    gatewayRestartTimer = null;
    if (!shuttingDown) {
      startGateway();
    }
  }, 1200);
}

function teardown(signal = "SIGTERM") {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[dev] shutting down (signal=${signal})...`);
  // Record *why* the launcher is tearing down so we can tell the difference
  // between a deliberate Cmd+Q ("SIGTERM") and a stray SIGHUP from closing
  // the parent terminal panel — both look identical from the children's
  // perspective.
  appendDevExitLog(
    `${new Date().toISOString()} teardown signal=${signal} children=${children.length}\n`,
  );
  if (gatewayRestartTimer) {
    clearTimeout(gatewayRestartTimer);
    gatewayRestartTimer = null;
  }
  for (const child of [...children].reverse()) {
    try {
      // Kill the entire process group (negative PID). Each child was started
      // with detached: true, so it is the leader of its own group; the signal
      // propagates to all descendants (e.g. pnpm exec → next dev → next-server,
      // or uv run → uvicorn), preventing the orphan-process port/lock leaks
      // we hit on plain Ctrl+C.
      process.kill(-child.pid, signal);
    } catch (e) {
      if (e && e.code === "EPERM") {
        // Different session (rare on macOS); fall back to PID-only kill.
        try { process.kill(child.pid, signal); } catch { /* already dead */ }
      }
      /* ESRCH or already dead — ignore */
    }
  }
  // Graceful exit: give children 5s to clean up (delete .next/dev/lock, close
  // webpack watcher, release ports, etc.). Next.js dev server needs 3-5s to
  // release its lockfile; anything shorter leaves a stale "Unable to acquire
  // lock" state on the next `pnpm run dev`. Escalate to SIGKILL for any
  // stubborn survivors after 3s.
  const forceKillTimer = setTimeout(() => {
    for (const child of [...children]) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already dead */
      }
    }
  }, 3000);
  setTimeout(() => {
    clearTimeout(forceKillTimer);
    process.exit(0);
  }, 5000);
}

function migrateDesktopConfigFile(configPath) {
  if (!configPath || !existsSync(configPath)) return;
  if (!migrateDesktopConfigYaml) {
    throw new Error("desktop config migration module was not loaded");
  }
  const original = readFileSync(configPath, "utf8");
  const migrated = migrateDesktopConfigYaml(original);
  if (migrated !== original) {
    writeFileSync(configPath, migrated, "utf8");
    console.log("[dev] migrated desktop config defaults");
  }
}

process.on("SIGINT", () => teardown("SIGINT"));
process.on("SIGTERM", () => teardown("SIGTERM"));
// macOS Terminal.app's default Close-Window behaviour sends SIGHUP to the
// session leader; without an explicit handler the default action terminates
// the process silently (no log, no console output) and the user only sees
// "the dev environment disappeared". Listening here gives us the same
// clean teardown as Ctrl+C.
process.on("SIGHUP", () => teardown("SIGHUP"));

// ── 1. Gateway (venv) ────────────────────────────────────────────────────
// In dev mode the gateway is launched here (not via backend.ts), so this
// script must inject the SAME isolation env vars that backend.ts does in
// production: QILIN_HOME, QILIN_CONFIG_PATH, QILIN_SKILLS_PATH.
//
// IMPORTANT: dev mode paths must mirror paths.ts — the desktop app home is
// ~/.kworks (NOT the legacy ~/Library/Application Support/...).
// This is critical for verifying the new directory layout, granted_paths.json
// authorization flow without a full package build.
const DESKTOP_HOME =
  process.env.HOME && join(process.env.HOME, ".kworks");

function initDesktopExtensionsConfig(configPath) {
  if (!configPath || existsSync(configPath)) return;
  writeFileSync(
    configPath,
    `${JSON.stringify({ mcpServers: {}, skills: {} }, null, 2)}\n`,
    "utf8",
  );
  console.log("[dev] initialized desktop extensions config");
}

function syncDesktopBuiltinSkills(skillsPath) {
  if (!skillsPath) return;
  const customTarget = join(skillsPath, "custom");
  mkdirSync(customTarget, { recursive: true });

  // Look for bundled builtin skills in the qilin/ submodule first (the engine
  // is the source of builtin skills now), then fall back to the legacy
  // repo-root skills/ directory.
  let builtinRoot = join(REPO_ROOT, "qilin", "skills", "builtin");
  if (!existsSync(builtinRoot)) {
    builtinRoot = join(REPO_ROOT, "skills", "builtin");
  }
  if (!existsSync(builtinRoot)) {
    // No bundled skills shipped — this is expected when the QiLin submodule
    // does not include a skills tree yet. The user can still create custom
    // skills under ~/.kworks/skills/custom/.
    return;
  }

  let totalCopied = 0;
  for (const sub of ["core", "task", "coding"]) {
    const bundledSub = join(builtinRoot, sub);
    if (!existsSync(bundledSub)) continue;
    const targetDir = join(skillsPath, "builtin", sub);
    mkdirSync(targetDir, { recursive: true });

    const existing = new Set(readdirSync(targetDir));
    for (const name of readdirSync(bundledSub)) {
      if (existing.has(name)) continue;
      cpSync(join(bundledSub, name), join(targetDir, name), { recursive: true });
      totalCopied++;
    }
  }
  if (totalCopied > 0) {
    console.log(`[dev] synced ${totalCopied} builtin skill(s) to ${skillsPath}`);
  }
}

function startGateway() {
  if (!existsSync(BACKEND_DIR)) {
    console.warn(`[dev] backend dir not found: ${BACKEND_DIR} — skipping gateway`);
    return;
  }

  // Mirror backend.ts buildEnv(): flat layout under ~/.kworks
  // (same as paths.ts getAppDataDir / getKworksHome).
  const kworksHome = DESKTOP_HOME;
  const configPath = kworksHome ? join(kworksHome, "config.yaml") : undefined;
  const extensionsConfigPath = kworksHome ? join(kworksHome, "extensions_config.json") : undefined;
  const dataDir = kworksHome ? join(kworksHome, "data") : undefined;
  const skillsPath = kworksHome ? join(kworksHome, "skills") : undefined;

  // Ensure the isolated state dir exists (matches backend.ts ensureDataDirs).
  if (kworksHome) {
    for (const sub of ["", "logs", "data", "threads", "agents"]) {
      mkdirSync(join(kworksHome, sub), { recursive: true });
    }
    if (configPath && !existsSync(configPath) && existsSync(EMBEDDED_CONFIG)) {
      copyFileSync(EMBEDDED_CONFIG, configPath);
    }
    migrateDesktopConfigFile(configPath);
    initDesktopExtensionsConfig(extensionsConfigPath);
    syncDesktopBuiltinSkills(skillsPath);
  }

  console.log(`[dev] starting gateway on port ${GATEWAY_PORT}...`);
  console.log(`[dev]   QILIN_HOME=${kworksHome}`);
  console.log(`[dev]   QILIN_CONFIG_PATH=${configPath}`);
  console.log(`[dev]   QILIN_EXTENSIONS_CONFIG_PATH=${extensionsConfigPath}`);
  console.log(`[dev]   QILIN_HOST_BASE_DIR=${dataDir}`);
  console.log(`[dev]   QILIN_SKILLS_PATH=${skillsPath}`);
  gatewayProcess = start("uv", ["run", "python", "-m", "uvicorn", "app.gateway.app:app", "--host", "127.0.0.1", "--port", GATEWAY_PORT], {
    cwd: BACKEND_DIR,
    env: {
      ...process.env,
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_PORT,
      GATEWAY_CORS_ORIGINS: DESKTOP_DEV_ORIGINS,
      CORS_ORIGINS: DESKTOP_DEV_ORIGINS,
      QILIN_DESKTOP_DEV: "1",
      PYTHONUNBUFFERED: "1",
      // Isolation: desktop state under ~/.kworks (matching paths.ts).
      ...(kworksHome ? { QILIN_HOME: kworksHome } : {}),
      // QiLin locates per-thread data roots via QILIN_HOST_BASE_DIR.
      ...(kworksHome ? { QILIN_HOST_BASE_DIR: kworksHome } : {}),
      ...(configPath ? { QILIN_CONFIG_PATH: configPath } : {}),
      ...(extensionsConfigPath ? { QILIN_EXTENSIONS_CONFIG_PATH: extensionsConfigPath } : {}),
      ...(skillsPath ? { QILIN_SKILLS_PATH: skillsPath } : {}),
    },
    onExit: () => {
      gatewayProcess = null;
      scheduleGatewayRestart();
    },
  });
}

// ── 2. Next.js dev server ────────────────────────────────────────────────
// IMPORTANT: dev mode does NOT set DESKTOP_BUILD. That env var switches Next.js
// to `output: "export"` (static), which is incompatible with the SSR auth guard
// in app/workspace/layout.tsx (`export const dynamic = "force-dynamic"`).
// Static export is only used by `desktop-build.mjs` (which patches that layout).
//
// In dev we run the normal SSR dev server with rewrites proxying /api/* to the
// desktop gateway on 29987. Desktop detection (`isDesktop()`) still works
// because it checks `window.kworksDesktop` (injected by the preload), not the
// DESKTOP_BUILD env var. Cookie-based auth flows through the Next.js proxy,
// matching fetcher.ts's `port === "28569"` credentials branch.
let frontendReadyPromise = null;

function ensureFrontendDeps() {
  // Frontend deps live in frontend/node_modules; if missing (fresh clone,
  // or after pnpm store prune), `pnpm exec next` fails with a confusing
  // "Command next not found" (ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL). Install
  // automatically so a fresh checkout boots with `pnpm run dev` alone.
  const nextBin = join(FRONTEND_DIR, "node_modules", ".bin", "next");
  if (existsSync(nextBin)) return;
  if (!existsSync(join(FRONTEND_DIR, "package.json"))) {
    console.error(`[dev] frontend/package.json not found at ${FRONTEND_DIR}`);
    process.exit(1);
  }
  console.log(
    `[dev] frontend deps missing — running 'pnpm install' in ${FRONTEND_DIR} (may take a minute)...`,
  );
  const installResult = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["install"],
    { cwd: FRONTEND_DIR, stdio: "inherit" },
  );
  if (installResult.status !== 0) {
    console.error(
      `[dev] pnpm install failed (exit ${installResult.status}); aborting.`,
    );
    process.exit(1);
  }
  console.log("[dev] frontend deps installed.");
}

function startFrontend() {
  ensureFrontendDeps();
  console.log(`[dev] starting Next.js dev server on port ${DEV_SERVER_PORT}...`);
  let markReady;
  frontendReadyPromise = new Promise((resolve) => {
    markReady = resolve;
  });
  start(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", DEV_SERVER_PORT],
    {
      cwd: FRONTEND_DIR,
      env: {
        ...process.env,
        // Route Next.js rewrites (/api/*) to the desktop gateway, NOT the web
        // gateway. next.config.js reads this env var (default 9193).
        KWORKS_INTERNAL_GATEWAY_BASE_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
        // Force same-origin rewrites even when the shell has web/desktop build
        // public URL env vars loaded.
        NEXT_PUBLIC_BACKEND_BASE_URL: "",
        NEXT_PUBLIC_LANGGRAPH_BASE_URL: "",
        GATEWAY_PORT,
      },
      onStdout: (chunk) => {
        if (chunk.includes("Ready in")) {
          markReady();
        }
      },
      onStderr: (chunk) => {
        if (chunk.includes("Ready in")) {
          markReady();
        }
      },
    },
  );
  return frontendReadyPromise;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForFrontendReady() {
  if (!frontendReadyPromise) {
    throw new Error("Frontend dev server has not been started");
  }
  await Promise.race([
    frontendReadyPromise,
    sleep(FRONTEND_READY_TIMEOUT_MS).then(() => {
      throw new Error(`Next.js dev server did not become ready at ${DEV_SERVER_URL}`);
    }),
  ]);
}

// ── 3. Electron ──────────────────────────────────────────────────────────
function startElectron() {
  console.log(`[dev] starting Electron (loading ${DEV_SERVER_URL})...`);
  start(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "electron", "."],
    {
      cwd: DESKTOP_DIR,
      env: {
        ...process.env,
        KWORKS_DEV_SERVER: "1",
        KWORKS_SKIP_BACKEND_AUTOLAUNCH: "1",
        GATEWAY_PORT,
      },
      onExit: () => {
        // When Electron exits (tray Quit, Cmd+Q, or crash), tear down the
        // entire dev environment so the gateway and Next.js don't linger.
        if (!shuttingDown) {
          console.log("[dev] Electron exited — tearing down dev environment");
          teardown("SIGTERM");
        }
      },
    },
  );
}

// ── Boot order: compile preload, then launch everything ───────────────────
async function main() {
  // Ensure the main/preload TS is compiled first.
  console.log("[dev] compiling main process...");
  try {
    spawn(
      process.platform === "win32" ? "pnpm.cmd" : "pnpm",
      ["run", "build"],
      { cwd: DESKTOP_DIR, stdio: "inherit" },
    ).on("exit", (code) => {
      if (code !== 0) {
        console.error("[dev] TS build failed; aborting.");
        process.exit(1);
      }
      import("../dist/config-migration.js")
        .then(async (migrationModule) => {
          migrateDesktopConfigYaml = migrationModule.migrateDesktopConfigYaml;
          startGateway();
          startFrontend();
          await waitForFrontendReady();
          startElectron();
        })
        .catch((e) => {
          console.error("[dev] failed to start desktop dev environment:", e);
          process.exit(1);
        });
    });
  } catch (e) {
    console.error("[dev] failed to start:", e);
    process.exit(1);
  }
}

main();
