# KWorks

Local-first AI workspace — an Electron shell wrapping a Next.js frontend and
the **QiLin** multi-agent engine (Python / LangGraph).

## Repository structure

```
KWorks/
├── desktop/      # Electron main process + preload (TypeScript)
├── frontend/     # Next.js renderer (static-export for desktop)
├── qilin/        # [git submodule] QiLin agent harness — the backend engine
└── scripts/      # Devops / setup helpers
```

## Quick start (development)

> Prerequisites: Node.js 22+, pnpm 10+, Python 3.12+, [uv](https://docs.astral.sh/uv/).

### 1. Clone with submodules

```bash
git clone --recurse-submodules <repo-url>
# If already cloned without submodules:
git submodule update --init --recursive
```

The `qilin/` submodule contains the entire backend engine (FastAPI gateway +
LangGraph multi-agent runtime). It is required for the desktop app to function.

### 2. Install frontend & desktop dependencies

```bash
cd frontend && pnpm install
cd ../desktop && pnpm install
```

### 3. Install QiLin engine dependencies

```bash
cd qilin
uv sync --extra gateway
cd ..
```

### 4. Launch the dev environment

```bash
cd desktop
pnpm run dev
```

This boots three coordinated processes:
1. The QiLin gateway (`uv run uvicorn app.gateway.app:app` on port 19987)
2. The Next.js dev server (port 18569)
3. Electron, pointed at the dev server

The gateway reads its config from `~/.kworks/config.yaml` (auto-created on
first launch from `desktop/backend-build/config.embedded.yaml`). User data
lives under `~/.kworks/`.

## Product Direction

**Local-first desktop** is the primary target: data, engine, and audit
trail all live on the user's machine. The QiLin engine's server surface
(multi-user/RBAC, 8 IM channels) is maintained as an optional deployment
shape and does not drive the current roadmap.

## Roadmap

Recently shipped: full conversation loop (regenerate / edit-resend via
checkpoint replay), execution-order rendering with collapsed thinking and
tool groups (Chinese tool labels), clarification + risky-tool approval
cards, previews for HTML/MD/XLSX/DOCX/PPTX/PDF/images/code, per-run file
change audit, native Playwright browser tools, slash skill picker, and a
570+-test backend suite including sandbox/env security regressions.

In progress / planned: restart-free orchestration mode switching,
orchestration visualization, qilinmem retrieval & dedup hardening,
interactive local browser (evaluating), IMAP/SMTP + office-document
tool groups, automation APIs for in-house apps (KStock).

## Known Issues

- Web WeChat blocks login for many accounts; the browser tools cannot
  bypass platform restrictions — prefer official APIs for WeChat surfaces.
- PDF preview relies on Chromium's built-in engine; malformed files fall
  back to an error state with a download escape hatch.
- Very large XLSX/PPTX previews may stutter on low-end machines.
- Windows/Linux signing & notarization happen only in the CI release
  pipeline; locally built packages are unsigned.

## License

MIT
