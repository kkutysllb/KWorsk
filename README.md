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

## License

MIT
