import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const devLauncherSource = readFileSync(
  new URL("../scripts/dev.mjs", import.meta.url),
  "utf8",
);

test("desktop dev launcher owns and respawns the gateway process", () => {
  assert.match(devLauncherSource, /let gatewayProcess = null/);
  assert.match(devLauncherSource, /function scheduleGatewayRestart\(\)/);
  assert.match(devLauncherSource, /gatewayRestartTimer = setTimeout/);
  assert.match(devLauncherSource, /scheduleGatewayRestart\(\)/);
});

test("desktop dev launcher marks backend as dev-managed for the gateway", () => {
  assert.match(devLauncherSource, /QILIN_DESKTOP_DEV: "1"/);
});

test("desktop dev launcher does not ask Electron BackendManager to spawn another gateway", () => {
  assert.match(devLauncherSource, /KWORKS_SKIP_BACKEND_AUTOLAUNCH: "1"/);
});

test("desktop dev launcher forces Next rewrites instead of public backend URLs", () => {
  assert.match(devLauncherSource, /NEXT_PUBLIC_BACKEND_BASE_URL: ""/);
  assert.match(devLauncherSource, /NEXT_PUBLIC_LANGGRAPH_BASE_URL: ""/);
});

test("desktop dev frontend binds to localhost instead of all interfaces", () => {
  assert.match(devLauncherSource, /"next", "dev", "--hostname", "127\.0\.0\.1", "--port", DEV_SERVER_PORT/);
});

test("desktop dev launcher waits for the frontend before opening Electron", () => {
  assert.match(devLauncherSource, /async function waitForFrontendReady\(\)/);
  assert.match(devLauncherSource, /frontendReadyPromise/);
  assert.match(devLauncherSource, /Ready in/);
  assert.match(devLauncherSource, /await waitForFrontendReady\(\)/);
  assert.doesNotMatch(devLauncherSource, /fetch\(DEV_SERVER_URL/);
  assert.doesNotMatch(devLauncherSource, /setTimeout\(startElectron, 4000\)/);
});

test("desktop dev gateway CORS includes Electron's Next dev origins", () => {
  assert.match(devLauncherSource, /DESKTOP_DEV_ORIGINS/);
  assert.match(devLauncherSource, /http:\/\/127\.0\.0\.1:\$\{DEV_SERVER_PORT\}/);
  assert.match(devLauncherSource, /http:\/\/localhost:\$\{DEV_SERVER_PORT\}/);
  assert.match(devLauncherSource, /GATEWAY_CORS_ORIGINS: DESKTOP_DEV_ORIGINS/);
});

test("desktop dev launcher seeds builtin skills from the qilin submodule", () => {
  assert.match(devLauncherSource, /syncDesktopBuiltinSkills/);
  assert.match(devLauncherSource, /join\(REPO_ROOT, "qilin", "skills", "builtin"\)/);
  // QiLin does not use the legacy KKOCLAW_PUBLIC_SKILLS_ONLY flag.
  assert.doesNotMatch(devLauncherSource, /KKOCLAW_PUBLIC_SKILLS_ONLY/);
});

test("desktop dev launcher uses isolated empty extensions config", () => {
  assert.match(devLauncherSource, /initDesktopExtensionsConfig/);
  assert.match(devLauncherSource, /QILIN_EXTENSIONS_CONFIG_PATH/);
  assert.match(devLauncherSource, /extensions_config\.json/);
});

test("desktop dev launcher self-heals when uv is missing from PATH", () => {
  // IDE terminals on Windows inherit a stale PATH after uv installs, which
  // used to kill the gateway with "'uv' is not recognized". The launcher
  // must probe well-known install locations (pip --user, astral, cargo,
  // winget) instead of relying on PATH alone.
  assert.match(devLauncherSource, /function findUvOnPath\(\)/);
  assert.match(devLauncherSource, /function findUvInKnownLocations\(\)/);
  assert.match(devLauncherSource, /function getUvCommand\(\)/);
  assert.match(devLauncherSource, /start\(\s*getUvCommand\(\),/);
  // `uv run` must carry the gateway + browser extras (matching CI), otherwise
  // a fresh clone cannot boot the gateway at all (bare `uv run` skips extras).
  assert.match(devLauncherSource, /"run", "--extra", "gateway", "--extra", "browser", "python", "-m", "uvicorn"/);
});

test("desktop dev launcher kills the whole child tree on Windows", () => {
  // Windows has no process groups: the POSIX negative-PID group kill throws
  // there, so teardown used to silently kill nothing — orphaned next-server /
  // uvicorn processes survived Ctrl+C, held ports 18569/19987 and failed the
  // next start with EADDRINUSE. taskkill /T is the Windows equivalent of a
  // group kill.
  assert.match(devLauncherSource, /function killChildTree\(/);
  assert.match(devLauncherSource, /"taskkill", \["\/pid", String\(child\.pid\), "\/T", "\/F"\]/);
  // taskkill /T plus a child.kill() fallback — the combination verified to
  // leave zero orphans across repeated 3-level-tree runs.
  assert.match(devLauncherSource, /child\.kill\(\);/);
  // Every teardown path (graceful + 3s force-kill) must go through it.
  assert.match(devLauncherSource, /killChildTree\(child, signal\)/);
  assert.match(devLauncherSource, /killChildTree\(child, "SIGKILL"\)/);
});
