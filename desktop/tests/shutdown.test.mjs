import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const shutdownSource = readFileSync(new URL("../src/shutdown.ts", import.meta.url), "utf8");

test("desktop quit path forces exit after backend stop timeout", () => {
  assert.match(shutdownSource, /stopBackendWithTimeout/);
  assert.match(shutdownSource, /timeoutMs = 2000/);
  assert.match(mainSource, /stopBackendWithTimeout/);
  // before-quit stops the backend gracefully, THEN re-triggers the quit
  // lifecycle. app.quit() (NOT app.exit()) is required so Squirrel.Mac can
  // apply pending updates; the isShuttingDown guard lets the re-triggered
  // quit pass through the full lifecycle.
  assert.match(mainSource, /stopBackendWithTimeout\(backend, 3000\)/);
  assert.match(mainSource, /app\.quit\(\)/);
});
