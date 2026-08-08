import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const backendSource = readFileSync(
  new URL("../src/backend.ts", import.meta.url),
  "utf8",
);
const embeddedConfig = readFileSync(
  new URL("../backend-build/config.embedded.yaml", import.meta.url),
  "utf8",
);

test("desktop backend initializes and uses an isolated config.yaml", () => {
  assert.match(backendSource, /initConfig\(\)/);
  assert.match(backendSource, /config\.embedded\.yaml/);
  assert.match(backendSource, /QILIN_CONFIG_PATH/);
  assert.match(backendSource, /QILIN_HOST_BASE_DIR/);
  assert.match(backendSource, /getDesktopConfigPath\(\)/);
});

test("desktop backend migrates existing isolated config.yaml on launch", () => {
  assert.match(backendSource, /migrateConfig\(\)/);
  assert.match(backendSource, /migrateDesktopConfigYaml\(original\)/);
  assert.match(backendSource, /config-migration\.js/);
});

test("desktop default config enables the agents API used by the desktop UI", () => {
  assert.match(embeddedConfig, /agents_api:\s*\n\s+enabled:\s+true/);
});

test("desktop default config does not ship a coding_agent section", () => {
  // The coding work mode and its coding_agent config were removed; the
  // embedded desktop default config must not carry the retired section.
  assert.doesNotMatch(embeddedConfig, /^coding_agent:/m);
});

test("desktop default config uses sqlite backend", () => {
  // sqlite_dir is injected at runtime by config-migration.ts as an absolute
  // path (~/.kworks/data); the embedded template only pins the backend type.
  assert.match(embeddedConfig, /database:\s*\n\s+backend:\s+sqlite/);
});

test("desktop backend uses an isolated extensions config instead of repo MCP config", () => {
  assert.match(backendSource, /QILIN_EXTENSIONS_CONFIG_PATH/);
  assert.match(backendSource, /getDesktopExtensionsConfigPath\(\)/);
  assert.match(backendSource, /initExtensionsConfig\(\)/);
});

test("desktop seeds bundled builtin skills and allows user-created custom skills", () => {
  // Seed bundled builtin skills so first run has a non-empty skill set.
  assert.match(backendSource, /customTarget/);
  assert.match(backendSource, /mkdirSync\(customTarget/);
  // QiLin does not use the legacy KKOCLAW_PUBLIC_SKILLS_ONLY flag.
  assert.doesNotMatch(backendSource, /KKOCLAW_PUBLIC_SKILLS_ONLY:\s*"1"/);
});
