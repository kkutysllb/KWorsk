import assert from "node:assert/strict";
import { test } from "node:test";

import { migrateDesktopConfigYaml } from "../dist/config-migration.js";

test("desktop config migration pins sqlite storage to the desktop data dir", () => {
  const migrated = migrateDesktopConfigYaml(`config_version: 8
database:
  backend: sqlite
  sqlite_dir: some/legacy/path
agents_api:
  enabled: false
`);

  // config-migration injects an absolute path (~/.kworks/data), not a $VAR.
  assert.match(migrated, /database:\n\s+backend:\s+sqlite\n\s+sqlite_dir:\s+.*\.kworks\/data/);
  assert.match(migrated, /agents_api:\n\s+enabled:\s+true/);
});

test("desktop config migration is idempotent for existing defaults", () => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const sqliteDir = home ? `${home}/.kworks/data` : ".kworks/data";
  const original = `config_version: 8
database:
  backend: sqlite
  sqlite_dir: ${sqliteDir}
agents_api:
  enabled: true
`;

  assert.equal(migrateDesktopConfigYaml(original), original);
  assert.equal(migrateDesktopConfigYaml(migrateDesktopConfigYaml(original)), original);
});

test("desktop config migration removes duplicate agents api sections", () => {
  const migrated = migrateDesktopConfigYaml(`config_version: 8
agents_api:
  enabled: true

agents_api:
  enabled: true
`);

  assert.equal((migrated.match(/^agents_api:/gm) ?? []).length, 1);
  assert.match(migrated, /agents_api:\n\s+enabled:\s+true/);
});

test("desktop config migration preserves explicit postgres database configs", () => {
  const original = `config_version: 8
database:
  backend: postgres
  postgres_url: $DATABASE_URL
agents_api:
  enabled: true
`;

  assert.equal(migrateDesktopConfigYaml(original), original);
});

const PRISTINE_COMMUNITY_BROWSER_BLOCK = `\
  # 浏览器自动化（已安装 playwright + Chromium，headless 模式运行）
  # 浏览器会话驻留在单 worker 内存中，保持 GATEWAY_WORKERS=1。
  - name: browser_navigate
    group: browser
    use: qilin.community.browser_automation.tools:browser_navigate_tool
    headless: true
    timeout_ms: 30000
    viewport_width: 1280
    viewport_height: 720
  - name: browser_snapshot
    group: browser
    use: qilin.community.browser_automation.tools:browser_snapshot_tool
  - name: browser_click
    group: browser
    use: qilin.community.browser_automation.tools:browser_click_tool
  - name: browser_type
    group: browser
    use: qilin.community.browser_automation.tools:browser_type_tool
  - name: browser_get_text
    group: browser
    use: qilin.community.browser_automation.tools:browser_get_text_tool
    max_chars: 8000
  - name: browser_back
    group: browser
    use: qilin.community.browser_automation.tools:browser_back_tool
  - name: browser_screenshot
    group: browser
    use: qilin.community.browser_automation.tools:browser_screenshot_tool
  - name: browser_close
    group: browser
    use: qilin.community.browser_automation.tools:browser_close_tool\
`;

test("desktop config migration swaps pristine community browser tools for native ones", () => {
  const config = `config_version: 8
tools:
${PRISTINE_COMMUNITY_BROWSER_BLOCK}

uploads:
  max_files: 10
`;
  const migrated = migrateDesktopConfigYaml(config);

  // Community tool ENTRIES are gone (the switch-back note in the new
  // comment legitimately mentions the community module path).
  assert.doesNotMatch(migrated, /use:\s*qilin\.community\.browser_automation/);
  assert.equal(
    (migrated.match(/use:\s*qilin\.tools\.builtins\.browser_tools/g) ?? [])
      .length,
    3,
  );
  // Idempotent: migrating the already-migrated config changes nothing.
  assert.equal(migrateDesktopConfigYaml(migrated), migrated);
});

test("desktop config migration leaves user-modified browser blocks untouched", () => {
  // One changed option (max_chars) breaks the pristine marker — the whole
  // block must survive verbatim and no native entries may be added.
  const modified = PRISTINE_COMMUNITY_BROWSER_BLOCK.replace(
    "max_chars: 8000",
    "max_chars: 9000",
  );
  const config = `tools:\n${modified}\n`;
  const migrated = migrateDesktopConfigYaml(config);

  assert.ok(migrated.includes(modified));
  assert.doesNotMatch(
    migrated,
    /use:\s*qilin\.tools\.builtins\.browser_tools/,
  );
});

test("desktop config migration leaves configs without the community browser suite alone", () => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  const sqliteDir = home ? `${home}/.kworks/data` : ".kworks/data";
  // Include the sections the baseline migrations enforce so the assertion
  // isolates the browser-block behaviour.
  const original = `config_version: 8
tools:
  - name: bash
    group: bash
    use: qilin.sandbox.tools:bash_tool
agents_api:
  enabled: true
database:
  backend: sqlite
  sqlite_dir: ${sqliteDir}
`;

  assert.equal(migrateDesktopConfigYaml(original), original);
});
