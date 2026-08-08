# KWorks

本地优先的 AI 工作区 —— 以 Electron 为外壳、Next.js 为渲染层、**麒麟（QiLin）**多智能体引擎（Python / LangGraph）为核心。

## 仓库结构

```
KWorks/
├── desktop/      # Electron 主进程 + preload（TypeScript）
├── frontend/     # Next.js 渲染层（桌面端静态导出）
├── qilin/        # [git submodule] 麒麟智能体引擎 —— 后端核心
└── scripts/      # 运维 / 配置辅助脚本
```

## 快速开始（开发模式）

> 前置要求：Node.js 22+、pnpm 10+、Python 3.12+、[uv](https://docs.astral.sh/uv/)。

### 1. 克隆仓库（含子模块）

```bash
git clone --recurse-submodules <仓库地址>
# 若已克隆但未拉取子模块：
git submodule update --init --recursive
```

`qilin/` 子模块包含完整的后端引擎（FastAPI gateway + LangGraph 多智能体运行时），是桌面端运行的必需依赖。

### 2. 安装前端与桌面端依赖

```bash
cd frontend && pnpm install
cd ../desktop && pnpm install
```

### 3. 安装麒麟引擎依赖

```bash
cd qilin
uv sync --extra gateway
cd ..
```

### 4. 启动开发环境

```bash
cd desktop
pnpm run dev
```

该命令会协调启动三个进程：
1. 麒麟 gateway（`uv run uvicorn app.gateway.app:app`，端口 19987）
2. Next.js 开发服务器（端口 18569）
3. Electron，加载开发服务器

gateway 从 `~/.kworks/config.yaml` 读取配置（首次启动时从 `desktop/backend-build/config.embedded.yaml` 自动创建）。用户数据存放在 `~/.kworks/` 目录下。

## 许可证

MIT
