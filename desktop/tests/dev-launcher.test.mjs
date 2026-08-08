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
