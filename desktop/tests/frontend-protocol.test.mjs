import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveFrontendRequestPath } from "../dist/frontend-protocol.js";

test("maps app route URLs to exported html files", () => {
  assert.equal(resolveFrontendRequestPath("/"), "index.html");
  assert.equal(resolveFrontendRequestPath("/login"), "login.html");
  assert.equal(resolveFrontendRequestPath("/setup?from=login"), "setup.html");
  assert.equal(resolveFrontendRequestPath("/workspace/chats"), "workspace/chats.html");
});

test("keeps static asset paths unchanged", () => {
  assert.equal(
    resolveFrontendRequestPath("/_next/static/chunks/main.js"),
    "_next/static/chunks/main.js",
  );
  assert.equal(resolveFrontendRequestPath("/favicon.svg"), "favicon.svg");
});

test("blocks path traversal before serving static assets", () => {
  assert.equal(resolveFrontendRequestPath("/_next/static/../../package.json"), "index.html");
  assert.equal(resolveFrontendRequestPath("/images/%2e%2e/%2e%2e/package.json"), "index.html");
  assert.equal(resolveFrontendRequestPath("/../../desktop-electron/package.json"), "index.html");
});

test("maps RSC navigation requests to Next 16 directory-form payloads", () => {
  // Next 15+/16 static exports emit `__next.<segments...>/__PAGE__.txt`
  // DIRECTORIES (the legacy flat `__next.<segments>.__PAGE__.txt` naming is
  // gone — serving a missing path falls back to index.html and the client
  // renders a blank page, the 1.0.8 "探索平台" bug).
  assert.equal(resolveFrontendRequestPath("/", true), "__next.__PAGE__.txt");
  assert.equal(
    resolveFrontendRequestPath("/workspace", true),
    "workspace/__next.workspace/__PAGE__.txt",
  );
  assert.equal(
    resolveFrontendRequestPath("/workspace/mcp", true),
    "workspace/mcp/__next.workspace/mcp/__PAGE__.txt",
  );
  // Dynamic chat ids map to the pre-rendered placeholder payload.
  assert.equal(
    resolveFrontendRequestPath("/workspace/chats/abc123", true),
    "workspace/chats/new/__next.workspace/chats/$d$thread_id/__PAGE__.txt",
  );
  // Agent chat routes have their own placeholder payload.
  assert.equal(
    resolveFrontendRequestPath("/workspace/agents/bob/chats/abc123", true),
    "workspace/agents/__init__/chats/new/__next.workspace/agents/$d$agent_name/chats/$d$thread_id/__PAGE__.txt",
  );
});
