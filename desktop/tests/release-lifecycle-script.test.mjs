import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const releaseScriptUrl = new URL("../../release.sh", import.meta.url);
const releaseScriptPath = fileURLToPath(releaseScriptUrl);
const releaseScriptSource = existsSync(releaseScriptUrl)
  ? readFileSync(releaseScriptUrl, "utf8")
  : "";

/**
 * Locate a usable bash. On Windows the `bash` on PATH may be the WSL relay
 * stub (which fails when no WSL distro is installed); fall back to Git for
 * Windows' bundled bash so the lifecycle script stays testable on dev
 * machines.
 */
function resolveBashExecutable() {
  const probe = spawnSync("bash", ["--version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  if (probe.status === 0 && (probe.stdout ?? "").includes("GNU bash")) {
    return "bash";
  }
  for (const candidate of [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

test("root release lifecycle script exposes a remote release flow", () => {
  assert.equal(existsSync(releaseScriptUrl), true);

  const bash = resolveBashExecutable();
  if (bash === null) {
    // No usable bash on this machine; the source-level assertions in the
    // next test still cover the release-flow contract.
    return;
  }

  const help = spawnSync(bash, [releaseScriptPath, "--help"], {
    encoding: "utf8",
    windowsHide: true,
  });

  assert.equal(help.status, 0, `stdout:\n${help.stdout}\nstderr:\n${help.stderr}`);
  assert.match(help.stdout, /Usage:/);
  assert.match(help.stdout, /--push/);
  assert.match(help.stdout, /--no-watch/);
  assert.match(help.stdout, /--resume/);
  assert.match(help.stdout, /GitHub Actions/);
});

test("release lifecycle script delegates desktop packaging to GitHub Actions", () => {
  assert.match(releaseScriptSource, /release-desktop\.yml/);
  assert.match(releaseScriptSource, /git push --atomic/);
  assert.match(releaseScriptSource, /gh run list/);
  assert.match(releaseScriptSource, /gh run watch/);
  assert.match(releaseScriptSource, /gh run view/);
  assert.match(releaseScriptSource, /gh release view/);
  assert.match(releaseScriptSource, /\.release-logs/);
  assert.match(releaseScriptSource, /verify_release_assets/);
  assert.doesNotMatch(releaseScriptSource, /pnpm run build:app/);
});
