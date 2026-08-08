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
