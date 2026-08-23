import { extname, normalize, sep } from "node:path";

const ASSET_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".css",
  ".map",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".ico",
  ".webp",
  ".avif",
  ".txt",
  ".json",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);

function stripQueryAndHash(pathname: string): string {
  return pathname.split("?")[0].split("#")[0];
}

function decodePath(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return null;
  }
}

function normalizeSafeRelativePath(input: string): string | null {
  const decoded = decodePath(stripQueryAndHash(input));
  if (decoded === null) return null;

  const clean = decoded.replace(/^\/+/, "").replaceAll("\\", "/");
  if (!clean) return "";

  if (clean.split("/").some((segment) => segment === "..")) {
    return null;
  }

  const normalized = normalize(clean).replaceAll(sep, "/");
  if (
    normalized === ".." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/") ||
    normalized.includes("\0")
  ) {
    return null;
  }
  return normalized === "." ? "" : normalized;
}

/**
 * Next.js App Router static-export RSC payload file naming (Next 15+/16).
 *
 * During client-side navigation, App Router fetches the destination URL with
 * `RSC: 1` header to retrieve the RSC Flight payload.  In a static export,
 * each pre-rendered page emits a DIRECTORY-form payload under its own route
 * directory: `__next.<segment 1>/<segment 2>/.../__PAGE__.txt` (the root page
 * is the flat `__next.__PAGE__.txt`).  Dynamic segments (e.g. `[thread_id]`)
 * are encoded as `$d$<paramname>`.
 *
 * Only the placeholder variant is pre-rendered for dynamic routes
 * (e.g. /workspace/chats/new).  All other ids have no payload directory.
 * Without a dedicated handler, the fetch returns the fallback HTML and
 * Next.js cannot parse it as a Flight payload — the client-side navigation
 * then renders a BLANK page (this was the 1.0.8 "探索平台 → blank" bug:
 * the handler still used the legacy flat `__next.<segments>.__PAGE__.txt`
 * naming, which Next 16 no longer emits).
 *
 * For RSC requests on dynamic routes, we therefore return the placeholder's
 * `__PAGE__.txt`.  Because `[thread_id]/page.tsx` is a client component, the
 * RSC payload only carries component references (not thread-specific data);
 * the actual id is read from usePathname() at runtime, so serving the
 * placeholder payload for any id is safe.
 */
const CHATS_DYNAMIC_RSC =
  "workspace/chats/new/__next.workspace/chats/$d$thread_id/__PAGE__.txt";
const AGENTS_DYNAMIC_RSC =
  "workspace/agents/__init__/chats/new/__next.workspace/agents/$d$agent_name/chats/$d$thread_id/__PAGE__.txt";
// login / setup live inside the `(auth)` route group. Next 16 encodes route
// groups in payload paths as `!` + base64(group name) — "(auth)" encodes to
// "KGF1dGgp", hence the `__next.!KGF1dGgp` directory observed in the export.
const LOGIN_RSC = "login/__next.!KGF1dGgp/login/__PAGE__.txt";
const SETUP_RSC = "setup/__next.!KGF1dGgp/setup/__PAGE__.txt";

export function resolveFrontendRequestPath(
  input: string,
  isRsc = false,
): string {
  const clean = normalizeSafeRelativePath(input);
  if (clean === null) {
    return "index.html";
  }

  // Root path: HTML shell for page loads, but RSC navigation requests must
  // get the root Flight payload — otherwise client-side navigation back to
  // "/" receives HTML and renders blank.
  if (!clean || clean === "") {
    return isRsc ? "__next.__PAGE__.txt" : "index.html";
  }

  if (clean === "favicon.svg") {
    return "favicon.svg";
  }

  // _next/ assets: webpack chunk URLs may be absolute (/_next/...) or
  // relative to the current page URL (e.g. workspace/chats/_next/...) when
  // the page is a dynamic route served via the fallback below. Normalize
  // any path containing _next/ to the canonical _next/ prefix so the file
  // is found in the static export directory.
  const nextIdx = clean.indexOf("_next/");
  if (nextIdx >= 0) {
    return clean.slice(nextIdx);
  }

  // Static assets with known extensions — check BEFORE the dynamic route
  // fallback so that resource requests are never accidentally served as
  // HTML pages.
  const ext = extname(clean);
  if (ext && ASSET_EXTENSIONS.has(ext)) {
    return clean;
  }

  // ── RSC payload requests (Next.js App Router client-side navigation) ──
  // Next.js sends `RSC: 1` header during client-side navigation to fetch
  // the Flight payload instead of HTML.  In a static export each pre-rendered
  // page directory contains a directory-form payload:
  // `__next.<segments...>/__PAGE__.txt`.
  //
  // If we return HTML for an RSC request, the Next.js client cannot parse the
  // Flight payload and the navigation renders a blank page (and a forced
  // full reload would kill every active SSE stream — chat replies,
  // long-running agent runs).  This was the #1 cause of tab-switch task
  // interruptions in the desktop packaged build.
  //
  // For dynamic routes (e.g. /workspace/chats/<id>) only one placeholder
  // variant is pre-rendered, so we map every id to that placeholder's
  // __PAGE__.txt.
  if (isRsc) {
    // Dynamic routes → placeholder RSC payload
    if (
      clean.startsWith("workspace/chats/") &&
      !clean.startsWith("workspace/chats/new")
    ) {
      return CHATS_DYNAMIC_RSC;
    }
    if (
      clean.startsWith("workspace/agents/") &&
      clean.includes("/chats/")
    ) {
      // Agent chat routes have their own pre-rendered placeholder payload
      // (component references differ from the plain chats route).
      return AGENTS_DYNAMIC_RSC;
    }

    // Static routes → canonical directory-form payload path.
    //   pathname ""           → "__next.__PAGE__.txt" (handled above)
    //   pathname "workspace"  → "workspace/__next.workspace/__PAGE__.txt"
    if (clean === "login") return LOGIN_RSC;
    if (clean === "setup") return SETUP_RSC;
    return `${clean}/__next.${clean}/__PAGE__.txt`;
  }

  // Desktop dynamic route fallback (only for page navigations — paths
  // without a file extension). Chat thread pages are fully client-rendered;
  // only "chats/new" is pre-rendered (via generateStaticParams in the
  // desktop build). For any other thread_id, serve the "new" page — the
  // ChatPage component reads thread_id from useParams() at runtime and
  // loads the correct thread data.
  if (
    clean.startsWith("workspace/chats/") &&
    !clean.startsWith("workspace/chats/new")
  ) {
    return "workspace/chats/new.html";
  }

  // Agent chat pages are not pre-rendered in the desktop build (agent_name
  // is dynamic and unknowable at build time). Fall back to the regular chat
  // page — the client-side router renders the correct agent-specific UI.
  if (
    clean.startsWith("workspace/agents/") &&
    clean.includes("/chats/")
  ) {
    return "workspace/chats/new.html";
  }

  return `${clean}.html`;
}

export function getFrontendURLPath(url: string, isRsc = false): string {
  const parsed = new URL(url);
  return resolveFrontendRequestPath(
    parsed.pathname + parsed.search + parsed.hash,
    isRsc,
  );
}
