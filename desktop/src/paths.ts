/**
 * Path resolution for the Electron desktop shell.
 *
 * Handles the difference between development (running from source) and
 * packaged (ASAR / unpacked resources) layouts. All path computation is
 * centralized here so the rest of the main process never branches on
 * `app.isPackaged`.
 */

import { app } from "electron";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * The repo root when running in development.
 *
 * `app.getAppPath()` returns the directory containing `package.json`,
 * i.e. `desktop/` itself. The repo root is one level above.
 */
const REPO_ROOT = resolve(app.getAppPath(), "..");

/** Whether we are running from a packaged app (not from source). */
export function isPackaged(): boolean {
  return app.isPackaged;
}

/**
 * The bundled Python gateway directory.
 *
 * - Packaged: `<resourcesPath>/gateway` (extraResources in electron-builder)
 * - Development: `<repo>/desktop/resources/gateway` (if present),
 *   otherwise `null` (fall back to the venv launcher).
 */
export function getGatewayDir(): string | null {
  if (isPackaged()) {
    return join(process.resourcesPath, "gateway");
  }
  const devDir = join(REPO_ROOT, "desktop", "resources", "gateway");
  return existsSync(devDir) ? devDir : null;
}

/**
 * The PyInstaller gateway executable path, or `null` if no bundle exists.
 *
 * On Windows the executable has an `.exe` suffix.
 */
export function getGatewayExecutable(): string | null {
  const dir = getGatewayDir();
  if (!dir) return null;
  const exe = process.platform === "win32" ? "kworks-gateway.exe" : "kworks-gateway";
  const path = join(dir, exe);
  return existsSync(path) ? path : null;
}

/**
 * The backend source directory — the QiLin engine submodule.
 *
 * In development this is `<repo>/qilin` (a git submodule pointing at the
 * QiLin agent harness framework). The gateway is launched there via
 * `uv run python -m uvicorn app.gateway.app:app`. Returns `null` in
 * packaged builds where the source tree is not present.
 */
export function getBackendDir(): string | null {
  if (isPackaged()) return null;
  return join(REPO_ROOT, "qilin");
}

/**
 * The embedded-frontend directory served by `BrowserWindow.loadFile`.
 *
 * - Packaged: `<resourcesPath>/frontend-out` (shipped via electron-builder
 *   `extraResources`)
 * - Development: `frontend/out` in the repo (built by `desktop-build.mjs`)
 */
export function getFrontendDistDir(): string {
  if (isPackaged()) {
    return join(process.resourcesPath, "frontend-out");
  }
  return join(REPO_ROOT, "frontend", "out");
}

/**
 * The app's writable data directory.
 *
 * Desktop runs under `~/.kworks` (NOT Electron's `userData` /
 * `~/Library/Application Support/...`) so the user can discover and back up
 * app state directly from their home folder. The legacy `~/.oclaw` layout
 * is migrated on first run — see `migrateLegacyUserData` in backend.ts.
 */
export function getAppDataDir(): string {
  return join(homedir(), ".kworks");
}

/**
 * The gateway state directory (`QILIN_HOME`).
 *
 * On desktop this is the same as `getAppDataDir()` (`~/.kworks`) —
 * config.yaml, data/, skills/ etc. all live directly under the home root,
 * without an extra nesting level. This keeps paths short and
 * user-discoverable.
 */
export function getKworksHome(): string {
  return getAppDataDir();
}

/** The desktop-owned gateway config file. */
export function getDesktopConfigPath(): string {
  return join(getKworksHome(), "config.yaml");
}

/** The desktop-owned extensions config file for MCP and skill enablement state. */
export function getDesktopExtensionsConfigPath(): string {
  return join(getKworksHome(), "extensions_config.json");
}

/**
 * The desktop-owned `.env` file holding skill model credentials.
 *
 * Skills such as image/video/music generation read provider credentials
 * from fixed environment variable names (e.g. `GEMINI_API_KEY`,
 * `MINIMAX_API_KEY`). The desktop shell runs fully isolated under `~/.kworks`
 * and never reads the QiLin repo-root `.env`. This path is the desktop
 * equivalent: `backend.ts` parses it on launch and injects every variable
 * into the gateway child-process environment so skill subprocesses inherit
 * them via `os.environ`.
 */
export function getSkillModelsEnvPath(): string {
  return join(getKworksHome(), ".env");
}

/**
 * Path to the persisted JWT signing secret.
 *
 * The desktop gateway must use a STABLE secret across restarts — otherwise
 * every app relaunch generates a new ephemeral ``AUTH_JWT_SECRET`` and
 * invalidates all existing JWTs, causing 401s on every API call until the
 * user re-logs in.
 */
export function getAuthJwtSecretPath(): string {
  return join(getKworksHome(), ".auth_jwt_secret");
}

/** The logs directory for gateway stdout/stderr. */
export function getLogsDir(): string {
  return join(getAppDataDir(), "logs");
}

/** The gateway log file path. */
export function getGatewayLogPath(): string {
  return join(getLogsDir(), "gateway.log");
}

/** The Electron main-process log file path. */
export function getMainLogPath(): string {
  return join(getLogsDir(), "main.log");
}

/** The renderer-process console log file path. */
export function getRendererLogPath(): string {
  return join(getLogsDir(), "renderer.log");
}

/**
 * The user-writable skills root.
 *
 * `~/.kworks/skills/` contains bundled `public/` skills (seeded on
 * first run from the PyInstaller bundle) AND a writable `custom/`
 * directory so users can create their own skills at runtime.
 */
export function getSkillsDir(): string {
  return join(getAppDataDir(), "skills");
}

/**
 * The bundled skills source directory (read-only).
 *
 * - Packaged: PyInstaller ships skills under `resources/gateway/_internal/skills/`.
 *   The spec bundles `skills/builtin` into `skills/builtin` of the gateway dir,
 *   so the bundled root is `<resourcesPath>/gateway/_internal/skills` (oneDir).
 * - Development: the repo `skills/` directory.
 *
 * Returns `null` when no bundled source is present (e.g. dev without repo).
 */
export function getBundledSkillsDir(): string | null {
  if (isPackaged()) {
    // PyInstaller onedir layout: <gateway>/_internal/skills/builtin
    const gatewayDir = getGatewayDir();
    if (!gatewayDir) return null;
    const candidates = [
      join(gatewayDir, "_internal", "skills"),
      join(gatewayDir, "skills"),
    ];
    for (const c of candidates) {
      // Prefer the new builtin/ layout, fall back to legacy public/
      if (existsSync(join(c, "builtin"))) return c;
      if (existsSync(join(c, "public"))) return c;
    }
    return null;
  }
  // Development: the KWorks repo no longer ships its own skills tree (the
  // QiLin engine submodule is the source of bundled builtin skills now).
  // Look for skills under the qilin/ submodule first, then the legacy
  // repo-root skills/ directory for backward compatibility.
  const qilinSkills = join(REPO_ROOT, "qilin", "skills");
  if (existsSync(qilinSkills)) return qilinSkills;
  const devSkills = join(REPO_ROOT, "skills");
  return existsSync(devSkills) ? devSkills : null;
}

/**
 * The bundled built-in skill sub-roots (core/task).
 *
 * Returns the paths to `builtin/core`, `builtin/task` inside the bundled
 * skills directory. Falls back to the legacy flat `public/` directory if the
 * new layout is not present.
 *
 * Returns an empty array if no bundled source exists.
 */
export function getBundledBuiltinSkillRoots(): string[] {
  const bundled = getBundledSkillsDir();
  if (!bundled) return [];
  const builtinDir = join(bundled, "builtin");
  if (existsSync(builtinDir)) {
    return ["core", "task"]
      .map((sub) => join(builtinDir, sub))
      .filter((p) => existsSync(p));
  }
  // Legacy fallback: flat public/ directory
  const legacyPublic = join(bundled, "public");
  return existsSync(legacyPublic) ? [legacyPublic] : [];
}

/** The embedded desktop default config template, if bundled. */
export function getBundledConfigTemplatePath(): string | null {
  const candidates = isPackaged()
    ? [
        join(process.resourcesPath, "gateway", "_internal", "config.embedded.yaml"),
        join(process.resourcesPath, "gateway", "config.embedded.yaml"),
      ]
    : [
        join(REPO_ROOT, "desktop", "backend-build", "config.embedded.yaml"),
      ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export { REPO_ROOT };
