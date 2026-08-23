import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const mainSource = readFileSync(new URL("../src/main.ts", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../src/preload.ts", import.meta.url), "utf8");
const ipcSource = readFileSync(new URL("../src/ipc.ts", import.meta.url), "utf8");

test("Windows shell is frameless with a top-right window-control overlay", () => {
  // The win32 branch must hide the native title bar but keep the
  // minimize / maximize / close overlay (frame: false would also drop
  // the overlay, the resize borders and Snap support).
  assert.match(mainSource, /process\.platform === "win32"\s*\n\s*\?\s*\{/);
  assert.match(mainSource, /titleBarStyle:\s*"hidden" as const/);
  assert.match(mainSource, /titleBarOverlay:\s*\{/);
  assert.doesNotMatch(mainSource, /frame:\s*false/);
});

test("Windows frameless shell hides the native menu bar but keeps accelerators", () => {
  // Menu bar is hidden per-window (the tray carries the menu instead), while
  // Menu.setApplicationMenu stays registered so accelerators keep working.
  assert.match(mainSource, /setMenuBarVisibility\(false\)/);
  assert.match(mainSource, /Menu\.setApplicationMenu\(buildAppMenu\(\)\)/);
});

test("macOS and Linux window chrome stays untouched", () => {
  // macOS keeps hiddenInset (never trafficLightPosition overrides).
  assert.match(mainSource, /titleBarStyle:\s*"hiddenInset" as const/);
  assert.doesNotMatch(mainSource, /trafficLightPosition:/);
  // The win32 frameless branch is scoped behind an explicit platform check.
  const framelessBranch = mainSource.match(
    /: process\.platform === "win32"\s*\n\s*\?\s*\{[\s\S]*?titleBarStyle:\s*"hidden" as const/,
  );
  assert.ok(framelessBranch, "frameless options must be scoped to win32");
});

test("tray menu carries the menu-bar feature set on Windows", () => {
  assert.match(mainSource, /function buildWindowsMenuBarTrayItems\(\)/);
  assert.match(
    mainSource,
    /if \(process\.platform === "win32"\) \{\s*\n\s*template\.push\(\.\.\.buildWindowsMenuBarTrayItems\(\)\);/,
  );
});

test("overlay re-tint IPC is registered and win32-only", () => {
  assert.match(ipcSource, /"window-controls:set-overlay"/);
  assert.match(ipcSource, /if \(process\.platform !== "win32"\) return;/);
  assert.match(ipcSource, /setTitleBarOverlay\(overlay\)/);
});

test("preload exposes the shell platform and overlay re-tint bridge", () => {
  assert.match(preloadSource, /platform:\s*process\.platform/);
  assert.match(preloadSource, /setTitleBarOverlay:\s*\(options: TitleBarOverlayOptions\)/);
});
