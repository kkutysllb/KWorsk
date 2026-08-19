# KWorks 项目架构分析报告

> 仓库根目录: `/Users/libing/kk_Projects/KWorks`
> 分析日期: 2025-08-19
> 覆盖版本: KWorks v1.0.7 (CHANGELOG.md) / 麒麟 (QiLin) 子模块随仓库固定
> 三大模块: `desktop/` (Electron 主壳)、`frontend/` (Next.js 渲染层)、`qilin/` (Python/LangGraph 后端)
>
> 本报告包含的所有文件路径与行号均来自本次源码阅读；代码片段保持原样不做翻译。

---

## 0. 顶层架构总览

```
+--------------------+      IPC over Electron preload       +------------------------+
|  desktop/ (TS)     |  ─────────────────────────────────► | frontend/ (Next.js)    |
|  Electron 主进程    |  window.kworksDesktop (contextBridge)|  静态导出 out/         |
|  - main.ts         |                                     |  app:// scheme         |
|  - preload.ts      |                                     |  Web build (rewrite)   |
|  - ipc.ts          |                                     +------------------------+
|  - backend.ts      |                                                │
|  - updater.ts      |                                                │
|  - paths.ts        |                                                │ HTTP/SSE
+--------------------+                                                │
          │  spawn uv run python -m uvicorn                           │ Bearer/CSRF
          ▼                                                            ▼
+--------------------------------------------+      ◄────────────────────┘
| qilin/app/gateway/app.py                    |
| FastAPI + uvicorn, port 19987 (desktop)    |  HTTP API + SSE stream
|                                            |
| lifespan() → langgraph_runtime()           |
|  ├ stream_bridge (in-mem / redis)          |
|  ├ checkpointer (sqlite / postgres)        |
|  ├ store (LangGraph Store)                 |
|  ├ run_event_store (memory/db/jsonl)       |
|  ├ scheduled_task_service                  |
|  └ channel_service (Feishu/Slack/...)      |
|                                            |
| Routers (25+, 见 §2):                      |
|   thread_runs / runs / threads / agents /  |
|   mcp / skills / memory / models / ...     |
+--------------------┬-----------------------+
                     │
                     ▼
+-----------------------------------------------------------------+
| qilin/qilin/  引擎核心包                                          |
|  ├ agents/        lead_agent + 31 middlewares + RuntimeFeatures  |
|  ├ orchestration/ graph.py / handoff.py / inbox.py / patterns.py |
|  ├ runtime/       run_manager.py + worker.py + stream_bridge +   |
|  │                checkpointer + store + events                  |
|  ├ subagents/     executor + batch + step_events                  |
|  ├ sandbox/       local / aio / e2b; SandboxProvider 抽象        |
|  ├ skills/        installer + security_scanner + storage         |
|  ├ tools/         builtins (task_tool / browser / search)        |
|  ├ mcp/           session_pool + client + tools                  |
|  ├ persistence/   engine + run/agent/user/channel_connections    |
|  ├ models/        factory + 各类 patched provider                 |
|  ├ scheduler/     schedules (next_run_at)                        |
|  ├ tracing/       monocle + factory + metadata                   |
|  ├ config/        app_config + 30+ 细粒度 *Config                 |
|  └ community/     browser_automation / integrated skills         |
+-----------------------------------------------------------------+
```

- 配置权威来源: `qilin/config/app_config.py::get_app_config()`，启动 + 每个请求读取 `~/.kworks/config.yaml`（详见 §3）。
- 持久化抽象: `RunStore` / `RunEventStore` / `MemoryRunStore` + SQLAlchemy AsyncEngine（`qilin/persistence/engine.py`）。
- 跨模块协议: 三套 — Electron IPC、HTTP REST、SSE stream（`POST /api/threads/{thread_id}/runs/stream`、`GET .../runs/{run_id}/join`）。

---

## 1. 总体架构 + IPC / HTTP / WS 三类协议

### 1.1 三层运行时

| 层 | 进程 | 关键文件 | 角色 |
|---|---|---|---|
| Shell (Electron) | 主进程 + 渲染进程 | `desktop/src/main.ts`、`desktop/src/preload.ts` | 启动并管理 `kworks-gateway.exe`/`uv run python -m uvicorn` 子进程；提供原生对话框、终端、更新、托盘 |
| Renderer (Next.js) | 渲染进程（同上） | `frontend/src/app/...`、`frontend/src/core/...` | React UI；通过 `window.kworksDesktop` 桥调主进程，通过 `fetch` 调本地 Gateway |
| Backend (QiLin) | Electron 拉起的 Python 进程 | `qilin/app/gateway/app.py`、`qilin/qilin/...` | LangGraph 运行时、run 管理、工具调用、IM 渠道、调度任务、MCP |

### 1.2 三种协议

#### 1.2.1 Electron IPC（contextBridge）

- 渲染进程绝不直接 import electron。`desktop/src/preload.ts:90` `contextBridge.exposeInMainWorld("kworksDesktop", { ... })` 暴露桥，1:1 镜像 `desktop/src/ipc.ts` 中 `ipcMain.handle` 的所有通道。
- 桥接口契约: `frontend/src/core/desktop/types.ts:130-211` (`DesktopBridge`)。
- 通道列表（`desktop/src/ipc.ts:286-425 registerIpc()`）：
  ```ts
  backend:start / stop / restart / get-status / get-logs / get-gateway-config
  dialog:pick-files / pick-directory
  shell:open-external / open-folder
  terminal:start / write / resize / stop
  skill-models:get / set
  ```
- 嵌入终端基于 `node-pty@^1.1.0`（`desktop/src/ipc.ts:11`），自愈权限 `ensureNodePtySpawnHelperExecutable`（同文件 `:119`）。
- 自动更新: `desktop/src/updater.ts` 走 `electron-updater@^6.3.9`，同时通过 `webRequest.onBeforeRequest` 把 `github.com/*/releases/download/*` 走 `KWORKS_GH_MIRROR`（默认 `gh-proxy.com`）（`updater.ts:70-104`）。
- 卸载侧 IPC: `desktop/src/ipc.ts:428 forwardFileDrop` 处理拖拽文件回送。

#### 1.2.2 HTTP REST + SSE

- 入口: `qilin/app/gateway/app.py:448-680 create_app()`。FastAPI 单 app，注入 4 层中间件（顺序见下），随后挂载 25+ routers（`app.py:579-666`）。
- 中间件栈 (`app.py:546-575`)：
  ```python
  AuthMiddleware    # app/gateway/auth_middleware.py — fail-closed 安全网
  CSRFMiddleware    # app/gateway/csrf_middleware.py — Double Submit Cookie
  CORSMiddleware    # 按 get_configured_cors_origins() 渲染
  TraceMiddleware   # app/gateway/trace_middleware.py — X-Trace-Id
  ```
- 25+ routers 一览（`app/gateway/routers/`）：
  ```
  agents / artifacts / assistants_compat / auth / browser / channel_connections
  channels / config_router / console / datasources / features / feedback
  github_webhooks / input_polish / integrations / mcp / memory / models
  persistence / runs / scheduled_tasks / skills / suggestions / thread_runs
  threads / uploads
  ```
- LangGraph Platform 兼容路径: `app/gateway/routers/thread_runs.py:854-1031`
  - `POST /api/threads/{thread_id}/runs` — 创建 run
  - `POST /api/threads/{thread_id}/runs/stream` — **流式 SSE** 创建并执行
  - `POST /api/threads/{thread_id}/runs/wait` — 同步等待
  - `GET /api/threads/{thread_id}/runs/{run_id}/join` — 断线重连（`thread_runs.py:1003`）
  - `GET/POST /api/threads/{thread_id}/runs/{run_id}/stream` — 既有 run 续流（`thread_runs.py:1028-1031`）
- SSE 事件对齐 LangGraph Platform React 钩子契约（`thread_runs.py:1-9`），由 `@langchain/langgraph-sdk/react` 的 `useStream` 在前端消费（`frontend/src/core/threads/hooks.ts:3`）。

#### 1.2.3 前后端 `fetch` 桥接

- 唯一出口: `frontend/src/core/api/fetcher.ts:58 fetch()` —— 包装 `globalThis.fetch`，自动注入：
  - `X-CSRF-Token`（state-changing 方法 `POST/PUT/DELETE/PATCH`，读 `csrf_token` cookie，`fetcher.ts:31`）
  - `Authorization: Bearer <token>`（桌面端读 `localStorage.kworksDesktopSessionToken`，`fetcher.ts:86-92`）
  - `credentials: "include"` 条件分支 (`fetcher.ts:112-117`)
- SDK 客户端包装: `frontend/src/core/api/api-client.ts:172 createCompatibleClient()`，`onRequest` 钩子 = `prepareLangGraphRequest` (`api-client.ts:63`) → `injectDesktopAuthorization` → `injectCsrfHeader`。
- 409 分类器: `api-client.ts:106 isRunConflictError`、`api-client.ts:128 isInactiveRunStreamError`、`api-client.ts:143 isRunNotCancellableError`。

### 1.3 进程拓扑（运行模式分支）

| 模式 | 触发 | Renderer URL | Backend URL | 鉴权 |
|---|---|---|---|---|
| Web build | `pnpm run dev` (前端) | `localhost:<WEB_PORT>` (18569/9191) | 经 Next.js rewrite 到 `127.0.0.1:9193/api` (`frontend/next.config.js:48-87`) | Cookie + CSRF |
| Desktop dev | `cd desktop && pnpm run dev` | `http://localhost:18569` (Next.js dev) | `http://localhost:19987/api`（直连，跨端口 same-site） | Cookie + CSRF + Bearer |
| Desktop 打包 | 启动安装包 | `app://-` 自定义协议（`main.ts:47`） | `http://127.0.0.1:19987/api`（直连，跨 scheme） | Bearer only（CSRF 豁免） |

> 桌面端基地址选择器 `frontend/src/core/config/index.ts:34-83`：
> - `isDesktop()` — `window.kworksDesktop in window`
> - `isDesktopDevMode()` — `window.location.port === window.kworksDesktop.frontendPort`（默认 18569）
> - `isDesktopBackendManagedMode()` — `isDesktop() && !isDesktopDevMode()`
>
> 选择器返回 `http://localhost:<port>`（dev）vs `http://127.0.0.1:<port>`（managed），原因见 `config/index.ts:95-149` 的 100+ 行注释——主要是 `localhost` 与 `127.0.0.1` 浏览器视为不同 site，会阻断 SameSite cookies。

---

## 2. 模块边界 / 契约 / 依赖关系

### 2.1 Desktop → Frontend 边界

| 关注点 | 桌面侧（桌面契约） | 前端侧（消费契约） |
|---|---|---|
| 类型定义 | `desktop/src/preload.ts:14-83` (本地 Interface) | `frontend/src/core/desktop/types.ts:130-217` |
| 入口 | `contextBridge.exposeInMainWorld("kworksDesktop", ...)` (`preload.ts:90`) | `frontend/src/core/desktop/index.ts:1-302` 包装层 |
| 抽象 | `window.kworksDesktop!` | 全部走 `getBackendStatus()`、`startBackend()`、`openFilePicker()` 等，浏览器态自动 fallback |
| 异步健康 | `await ipcRenderer.invoke(channel, args)` | `await window.kworksDesktop.xxx(args)` |
| 推事件 | `webContents.send(channel, payload)` | `onTerminalData()`、`onTerminalExit()`、`onFileDrop()` 订阅并返回 dispose fn |

`core/desktop/types.ts:48-80` 中残留 `ServiceStateInfo` / `EnvCheckInfo` / `EnvVarInfo` / `StartupDiagnostics` 接口、`getStartupInfo()` 方法，对应的 preload 实现未保留（疑为 Tauri 时代残留，详见 §5）。

### 2.2 Frontend → QiLin 边界

| 关注点 | 前端 | QiLin |
|---|---|---|
| LangGraph 客户端 | `@langchain/langgraph-sdk/react::useStream` + 自定义 `Client` (`frontend/src/core/api/api-client.ts:172-209`) | 自定义 `thread_runs` router，事件名/字段对齐 LangGraph Platform 协议 |
| REST 调用 | `fetch()` 包装 (`fetcher.ts:58`) | `app/gateway/routers/*.py` FastAPI |
| 鉴权 | localStorage `kworksDesktopSessionToken` (`session.ts:1-25`) | `app/gateway/auth_middleware.py:110-145` cookie → Bearer 回落 |
| CSRF | `csrf_token` cookie + `X-CSRF-Token` header | `app/gateway/csrf_middleware.py:41 should_check_csrf` + Double Submit |
| 文件上传 | IPC 直传字节 (`dialog:pick-files` 返回 `Uint8Array`) | `app/gateway/routers/uploads.py` → `/api/threads/{thread_id}/uploads` |
| 文件沙箱 | 无 (browser 模式) | `qilin/sandbox/sandbox.py:44-167` 抽象 + `local_sandbox_provider.py:35-453` |

### 2.3 模块内依赖方向（QiLin）

```
app/  ─►  qilin/  ─►  langchain / langgraph / mcp / playwright / sqlalchemy
       (单向依赖，import 方向严格 app→qilin→3rd-party)
```

- 引擎单例: `qilin/runtime/__init__.py:1-96` 统一对外 API：
  ```python
  from qilin.runtime import RunManager, RunRecord, RunStatus, run_agent,
                             StreamBridge, MemoryStreamBridge, StreamEvent, ...
  from qilin.runtime import make_checkpointer, get_checkpointer, make_store, get_store
  ```
- 配置访问: `qilin/config/__init__.py:1-34` 暴露 `get_app_config()`、`get_paths()`、`get_memory_config()` 等。
- Agent 工厂: `qilin/agents/__init__.py:1-42` 延迟加载：
  ```python
  create_qilin_agent  # 纯参 SDK (factory.py)
  make_lead_agent     # 应用层 (lead_agent/agent.py)
  ThreadState/SandboxState/DeltaThreadState
  ```
- 编排层: `qilin/orchestration/__init__.py:1-10` 暴露 `AgentHandoff`/`HandoffResult`/`HandoffError`，`graph.py:50-161 OrchestratorGraph` 是单 orchestrator + N worker 的 LangGraph 编排。
- Subagent: `qilin/subagents/` 提供执行基座，`SubagentExecutor._aexecute` (`executor.py:803`) 是单一执行入口，被 `task_tool` 与 `batch.run_batch_async` (`batch.py:34-69`) 共同调用。

### 2.4 跨层依赖关键清单

| 来源 | 依赖 | 用途 |
|---|---|---|
| `desktop/src/backend.ts:235-249 resolveCommand` | `uv run python -m uvicorn app.gateway.app:app` | 不直接 `uvicorn`，确保走 venv Python |
| `desktop/src/backend.ts:282-314 buildEnv` | `QILIN_HOME`/`QILIN_HOST_BASE_DIR`/`QILIN_CONFIG_PATH`/`QILIN_EXTENSIONS_CONFIG_PATH`/`QILIN_SKILLS_PATH`/`AUTH_JWT_SECRET`/`GATEWAY_HOST`/`GATEWAY_PORT`/`PYTHONUNBUFFERED` | 完整子进程环境 |
| `qilin/qilin/config/paths.py:104-456 Paths` | 同上 `QILIN_HOME` / `QILIN_HOST_BASE_DIR` | 解析 `memory.json`、`USER.md`、`agents/{name}/`、`users/{user_id}/...`、`threads/{thread_id}/user-data/{` |
| `qilin/app/gateway/deps.py:683-716 get_current_user_from_request` | cookie → bearer → JWT → `LocalAuthProvider.get_user` | 双轨鉴权 |

---

## 3. 配置（`~/.kworks/config.yaml`）+ 启动顺序 + 数据流

### 3.1 配置来源与生命周期

| 文件 | 拥有方 | 作用 | 首次写入 |
|---|---|---|---|
| `~/.kworks/config.yaml` | desktop（首次拷贝 `desktop/backend-build/config.embedded.yaml`） | 引擎配置主源 | `backend.ts:612 initConfig`（`backend.ts:138` 调用） |
| `~/.kworks/extensions_config.json` | desktop | MCP 自定义配置 | `backend.ts:650 initExtensionsConfig` |
| `~/.kworks/.env` | desktop（前端经 IPC `skill-models:get/set` 改写） | 技能模型 API Key | `backend.ts:675 initSkillModelsEnv` |
| `~/.kworks/.auth_jwt_secret` | desktop | JWT 签名密钥（持久化） | `backend.ts:785 ensureAuthJwtSecret` |
| `~/.kworks/skills/public/` | desktop | 内置技能（首次种子化） | `backend.ts:826 initSkills` |
| `~/.kworks/skills/custom/` | desktop（用户） | 用户自建技能 | empty dir created |
| `~/.kworks/data/`、`threads/`、`agents/`、`logs/` | desktop | 子进程数据目录 | `backend.ts:603 ensureDataDirs` |
| `~/.kworks/.migrated_v3` | desktop | 旧数据迁移完成哨兵 | `backend.ts:533 migrateLegacyUserData` |

加载优先级与热重载边界（`qilin/qilin/config/reload_boundary.py:36-80 STARTUP_ONLY_FIELDS`）：

```
启动-只读字段（需重启 gateway）：
  database / checkpointer / run_events / agent_storage / stream_bridge /
  sandbox / log_level / logging / channels / channel_connections /
  scheduler / run_ownership / dedupe_storage

可热重载字段（每请求 get_app_config() 重新加载）：
  models / tools / tool_groups / memory / subagents / title / 等等
```

`get_app_config()` (`qilin/config/app_config.py:699-732`) 逻辑：
1. 检查 `_current_app_config` ContextVar（运行期 override）。
2. 比较 `_app_config_signature`（内容哈希）+ `_app_config_mtime`，任一变化 → `_load_and_cache_app_config` 重载。
3. 校验 `config_version`，缺 < example 则日志警告 (`app_config.py:514-556`)。

子模块配置示例（`qilin/qilin/config/extensions_config.py`）按 `extensions_config.json` 注入 `extensions` 段。

### 3.2 启动顺序

```
1. Electron 主进程启动 (main.ts)
   └ gotSingleInstanceLock = app.requestSingleInstanceLock() (main.ts:73)
   └ powerSaveBlocker.start("prevent-app-suspension") (main.ts:608) [macOS]
   └ registerFrontendProtocol() 注册 app://- (main.ts:322-357)
   └ createAppWindow() (main.ts:139-238) — 加载 app://-（或 dev 时 DEV_SERVER_URL）
   └ registerIpc() 返回 BackendManager (main.ts:619; ipc.ts:286-425)
   └ registerUpdater() (main.ts:627; updater.ts)
   └ registerShortcuts() (main.ts:637; CmdOrCtrl+Shift+O)
   └ backend.launch() (main.ts:632)

2. BackendManager.launch() (backend.ts:126-186)
   ├ migrateLegacyUserData()    ← ~/.oclaw / ~/.kkoclaw → ~/.kworks
   ├ ensureDataDirs()           ← ~/.kworks/{logs,data,threads,agents}
   ├ initConfig()               ← 拷 config.embedded.yaml → ~/.kworks/config.yaml
   ├ migrateConfig()            ← config-migration.ts 增量合并
   ├ initExtensionsConfig()
   ├ initSkillModelsEnv()
   ├ initSkills()               ← 种子化内置技能到 ~/.kworks/skills/public/
   ├ openLogStream()
   ├ resolveCommand(port)       ← 三包降级：PyInstaller / uv run / 失败
   ├ spawn(cmd, env=buildEnv())
   ├ wireProcessIO()            ← pipe stdout/stderr → logs[] + gateway.log
   └ startHealthMonitor(port)   ← 每 500ms 探 /health，超时 120s

3. Gateway 启动 (uvicorn → app.py)
   ├ lifespan()  (app.py:200-445)
   │  ├ configure_logging()
   │  ├ ensure_browser_runtime_available()  (app/gateway/browser_capability.py)
   │  ├ setup_monocle_tracing_if_enabled()  (qilin/tracing/monocle.py)
   │  ├ retrieval_warm_task = warm memory index in bg
   │  ├ tiktoken warm-up (5s timeout)
   │  ├ cleanup_stale_upload_staging_files
   │  ├ langgraph_runtime(app, startup_config) (deps.py:354-530)
   │  │  ├ make_stream_bridge(config)
   │  │  ├ init_engine_from_config(config.database)
   │  │  ├ make_checkpointer(config)
   │  │  ├ make_store(config)
   │  │  ├ RunRepository / FeedbackRepository
   │  │  ├ ThreadMetaStore
   │  │  ├ RunEventStore (memory/db/jsonl)
   │  │  ├ RunManager(store=..., event_store=..., on_orphans_recovered=...)
   │  │  ├ reconcile_orphaned_inflight_runs()  ← 启动期恢复
   │  │  └ start_heartbeat()
   │  ├ _ensure_admin_user(app)  ← 迁移孤儿 thread
   │  ├ start_channel_service(startup_config, get_stream_bridge=...)
   │  └ ScheduledTaskService.start()
   └ create_app() 挂载所有 routers + 中间件
```

### 3.4 关键数据流（前端 → 后端）

```
用户在 chat input 输入文本
   │
   ▼
useThreadStream()  (frontend/src/core/threads/hooks.ts:212)
   ├ useStream({ onThreadId, onCreated, onLangChainEvent, onUpdateEvent }) (hooks.ts:333)
   └ client.runs.stream(threadId, assistantId, payload)
            │
            ▼
@langchain/langgraph-sdk/client::Client
   └ onRequest = prepareLangGraphRequest  (api-client.ts:63)
       ├ injectDesktopAuthorization    ← Bearer kworksDesktopSessionToken
       └ injectCsrfHeader              ← X-CSRF-Token (state-changing)
            │
            ▼ POST http://127.0.0.1:19987/api/threads/{id}/runs/stream
FastAPI gateway (qilin/app/gateway/app.py)
   ├ AuthMiddleware 校验 cookie/Bearer  (app/gateway/auth_middleware.py:92)
   ├ CSRFMiddleware 校验 header        (app/gateway/csrf_middleware.py)
   ├ CORSMiddleware
   └ thread_runs.router.stream_run()  (app/gateway/routers/thread_runs.py:864)
       ├ require_permission
       ├ build RunContext
       ├ RunManager.create → 持久化 pending → RunRepository.put
       ├ start_run(...) → asyncio.Task
       └ return StreamingResponse(...)
            │
            ▼
run_agent()  (qilin/qilin/runtime/runs/worker.py:568)
   ├ _stream_once / _stream_attempt (worker.py:922/944)
   │  ├ graph.astream(stream_mode=[values,updates,messages])
   │  ├ CheckpointStateAccessor
   │  └ bridge.publish(run_id, "messages", data)
   │
   ▼
StreamBridge.publish (qilin/qilin/runtime/stream_bridge/memory.py)
   └ asyncio.Queue.put_nowait(StreamEvent)
            │
            ▼
SSE consumer (sse_consumer() in app/gateway/services.py)
   └ writes event: <name>\nid: <id>\ndata: <json>\n\n
            │
            ▼
HTTP response stream → 渲染进程 fetch body chunks
   └ onUpdateEvent(data) (hooks.ts:378) 累加/去重消息
   └ onLangChainEvent (hooks.ts:370) 处理工具结束事件
```

反向命令流（取消、互动卡响应）走标准 `POST /api/threads/{id}/runs/{run_id}/cancel` 与 `POST /api/threads/{id}/runs`，后端 `RunManager.cancel` (`runtime/runs/manager.py:1187`) 通过 `abort_event` 触发 `worker.py:626 _finish_cancellation`。

### 3.5 数据持久化拓扑

| 数据 | 持久化后端 | 入口 | Schema |
|---|---|---|---|
| 对话 thread 元数据 | LangGraph `BaseStore` 或 SQLite (`qilin/persistence/thread_meta`) | thread_runs/runs routers | `user_id / thread_id / metadata` |
| Run 元数据（含 token 用量） | `RunRepository` (`qilin/persistence/run/sql.py`) | `runtime/runs/store/base.py:44 RunStore` 抽象 | `RunRow` (`qilin/persistence/run/model.py`) |
| Checkpoints | `AsyncSqliteSaver` / `AsyncPostgresSaver` / `InMemorySaver` | `qilin/runtime/checkpointer/async_provider.py:171` | LangGraph 自身 |
| User / Auth | SQLiteUserRepository | `app/gateway/auth/repositories/sqlite.py` | `users` 表 |
| Scheduled tasks | `ScheduledTaskRepository` / `ScheduledTaskRunRepository` | `app/scheduler/service.py:24` | |
| Channel connections | `ChannelConnectionStore` | `app/channels/store.py` | |
| Memory | `MemoryConfig` → DeerMem + tiktoken | `qilin/agents/memory/` | 文件 + 检索索引 |
| Skills（用户自建） | `~/.kworks/skills/custom/` 文件系统 | `qilin/skills/storage.py` | YAML + markdown |

---

## 4. 核心抽象 / 可替换点

### 4.1 引擎侧（Python）

| 抽象 | 定义位置 | 可替换点 |
|---|---|---|
| `Sandbox` / `SandboxProvider` | `qilin/sandbox/sandbox.py:44` + `sandbox_provider.py:10` | `local_sandbox_provider`、`aio_sandbox_provider`、`e2b` 等；通过 `config.sandbox.use` 反射替换 |
| `StreamBridge` | `qilin/runtime/stream_bridge/base.py:53` + `memory.py` + `redis.py` | 进程内 `MemoryStreamBridge`（默认）、`RedisStreamBridge`（跨进程）；按 `stream_bridge.type == "redis"` 在 `async_provider.py` 懒加载（`__init__.py:9-19` 注释） |
| `RunStore` | `qilin/runtime/runs/store/base.py:44` | `MemoryRunStore` (默认) / `RunRepository` (SQLAlchemy)；后者支持 Postgres 多 worker 租赁与心跳 |
| `CheckpointSaver` | `qilin/runtime/checkpointer/async_provider.py:171` | `InMemorySaver` / `AsyncSqliteSaver` / `AsyncPostgresSaver`（按 `database.backend`） |
| `RunEventStore` | `qilin/runtime/events/store/base.py` | memory / jsonl / db |
| `MCPSessionPool` | `qilin/mcp/session_pool.py:47` | 通过 `(server_name, scope_key)` 池化 MCP sessions；owner-task 设计强制 enter/exit 同任务（防 anyio cancel scope 错位） |
| `LocalAuthProvider` + `SQLiteUserRepository` | `app/gateway/auth/local_provider.py` + `auth/repositories/sqlite.py` | local provider；`oidc.py` 实现外部 OIDC |
| `MemoryManager` | `qilin/agents/memory/__init__.py` + `get_memory_manager` | DeerMem 等后端；启动期 `warm_retrieval` 重建检索索引 |
| `Agent` 工厂 | `qilin/agents/factory.py:72 create_qilin_agent` 与 `qilin/agents/lead_agent/agent.py make_lead_agent` | 纯参 SDK 入口 vs AppConfig 驱动的应用入口 |
| `OrchestratorGraph` | `qilin/orchestration/graph.py:50` | 单 orchestrator + N worker；`patterns.orchestrator_workers` (`orchestration/patterns.py:19`) 提供并行分派，`peer_consensus` 提供对等评审 |
| `SubagentExecutor._aexecute` | `qilin/subagents/executor.py:803` | 实现 `_SubagentExecutor` Protocol (`batch.py:15`) 即可被编排层和并行批处理复用 |
| `ChannelService` + `Channel` | `app/channels/service.py:93` + `feishu.py`/`slack.py`/`telegram.py`/`wechat.py`/`dingtalk.py`/`discord.py`/`wecom.py`/`github.py` | 实现 `start()/stop()/handle_event()` 即可接入新 IM |
| `ScheduledTaskService` | `app/scheduler/service.py:24` | cron 轮询 + 租约 + 并发上限；通过 `app.scheduler.launch_scheduled_thread_run` 注入 launcher |
| `BrowserSessionManager` | `qilin/community/browser_automation/session.py` | Playwright 私有事件循环（loop-affine 隔离） |
| `SkillInstaller` / `SkillStorage` | `qilin/skills/installer.py` + `storage.py` | skill 安装/扫描/安全审计 hook |
| `ModelConfig` → `create_chat_model` | `qilin/qilin/models/factory.py` | 支持 MiniMax/OpenAI/Claude/Mindie/vLLM/Codex 等 patched provider |

### 4.2 前端侧（TypeScript）

| 抽象 | 文件 | 说明 |
|---|---|---|
| `DesktopBridge` | `frontend/src/core/desktop/types.ts:130-211` | 桌面 IPC 全量类型；可重新生成对齐主进程 |
| `core/config/index.ts` 三个 isDesktop* 检测器 | `frontend/src/core/config/index.ts:34-83` | 路由分支统一入口 |
| `fetcher.fetch()` | `frontend/src/core/api/fetcher.ts:58` | 中央 fetch 包装；任何新增后端调用应走它 |
| `getAPIClient()` | `frontend/src/core/api/api-client.ts:200` | 缓存 + sanitize stream options |
| `useThreadStream` | `frontend/src/core/threads/hooks.ts:212` | 包装 `useStream` 的状态机：断线恢复、队列自动发送、跨 mount 状态缓存（`hooks.ts:230-247`） |
| `core/i18n`、`core/auth/AuthProvider` | 见 `frontend/src/core/auth/AuthProvider.tsx` | 全局 Provider；`workspace/layout.tsx:21-105` 渲染前先做 auth 守卫 |

### 4.3 配置驱动的可替换点

- **多租户 vs 单租户**: `app_config.AuthAppConfig` + `auth_disabled` flag (`app/gateway/auth_disabled.py`) → 一行配置切换单/多用户。
- **多 agent 模式**: `orchestration.mode: single | multi` (`qilin/qilin/config/orchestration_config.py:27`)，single 走 `task_tool`，multi 走 `OrchestratorGraph`。
- **多 worker 部署**: `GATEWAY_WORKERS > 1` 强制要求 Postgres + heartbeat + run_events=db (`deps.py:64-116 _enforce_postgres_for_multi_worker`)。
- **IM 渠道热增减**: `channels.*` 段配置；启动一次性构建（`service.py:436 start_channel_service`）。
- **LLM Provider**: `models.*` 段；`qilin/qilin/models/factory.py` 反射创建。

---

## 5. 架构亮点与风险

### 5.1 亮点

1. **三层边界清晰、契约完备**：
   - 桌面 ↔ 渲染: `contextBridge` 显式列出 25+ 方法 + TS 接口镜像 (`desktop/src/preload.ts:90` ↔ `frontend/src/core/desktop/types.ts:130`)。
   - 渲染 ↔ 网关: `fetcher` + `prepareLangGraphRequest` 两个中央包装器，CSRF/Bearer/credentials 策略三态分支透明 (`fetcher.ts:107-117`)。
   - 网关 ↔ 引擎: routers ↔ `qilin.runtime` / `qilin.config` / `qilin.agents` 单向依赖。
2. **配置热重载边界工程化**：
   - `qilin/qilin/config/reload_boundary.py:45-80 STARTUP_ONLY_FIELDS` 字典化声明每字段的 "startup-only" 含义，IDE hover 同步显示；新字段必须登记，否则测 `test_reload_boundary` 失败。
3. **多 worker 安全门**：
   - `deps.py:64-116` `_enforce_postgres_for_multi_worker` 启动期硬断言 `GATEWAY_WORKERS > 1` 必须 Postgres + run_events=db + heartbeat=on，错误信息直接说明为何 SQLite 不能跑多 worker。
4. **LangGraph 协议兼容**：
   - `thread_runs.py:1-9` 注释明确声明 SSE 事件名/字段对齐 LangGraph Platform React hook；`useStream` 在前端零修改即可用 (`frontend/src/core/threads/hooks.ts:333`)。
5. **StreamBridge 解耦 Producer/Consumer**：
   - `qilin/runtime/stream_bridge/base.py:53` 抽象层故意只暴露 `publish/publish_end/subscribe/cleanup/close`；`MemoryStreamBridge` 默认；`RedisStreamBridge` 按需懒加载（避免无 Redis 时导入 `redis.asyncio`）。
6. **RSC + 自定义协议正确支持 Next.js App Router**：
   - `desktop/src/frontend-protocol.ts:82-83` 硬编码 RSC 路径 `workspace/chats/new/__next.workspace.chats.$d$thread_id.__PAGE__.txt`；`main.ts:331` 检测 `RSC: 1` header；任一缺失都会导致 tab 切换整页刷新并杀死 SSE（注释清楚）。
7. **跨模式鉴权分流**：
   - `app/gateway/auth_middleware.py:110-145` cookie → Bearer 回落；`fetcher.ts:112-117` 按模式选 `credentials: include`；CSRF 中间件对 Bearer 路径自动豁免。
8. **重启安全**：
   - `desktop/src/backend.ts:533-601 migrateLegacyUserData` 一次性处理 `~/.oclaw` + `~/.kkoclaw` 两种旧路径；`backend.ts:785-810 ensureAuthJwtSecret` 让 JWT 密钥跨重启稳定，避免 session 失效风暴。
9. **Run 心跳 + 租约 + 孤儿恢复**：
   - `runtime/runs/manager.py:1883 start_heartbeat` 周期续约；`reconcile_orphaned_inflight_runs` (`manager.py:1700-1784`) 在 worker 启动期扫过期租约；`claim_for_takeover` 用 SQL 条件 update 闭锁过期租约与心跳续约的竞争。
10. **Subagent 失败隔离**：
    - `batch.run_batch_async` (`qilin/qilin/subagents/batch.py:34-69`) 用 `asyncio.Semaphore(max_concurrency)` + `asyncio.gather` + 单点异常吞咽保证一个子代理崩了不影响其他。

### 5.2 风险 / 待治理点

| # | 风险 | 证据 |
|---|---|---|
| R1 | **死代码/未对齐的 preload 接口**：前端 `DesktopBridge` 仍声明 `getStartupInfo()` / `StartupDiagnostics` / `ServiceStateInfo` / `EnvCheckInfo`，但当前 `desktop/src/preload.ts` 不再暴露此方法。残留可能让读源码的人困惑。 | `frontend/src/core/desktop/types.ts:48-80, 149` vs `desktop/src/preload.ts` |
| R2 | **包内嵌 skills 路径依赖**：`desktop/src/backend.ts:184-249 resolveCommand` 三层降级——优先 PyInstaller exe → `uv run python -m uvicorn` → 失败。若用户机器既无打包 exe 也没装 `uv`，会立刻失败而不给出下载链接；初次用户体验差。 | `backend.ts:147-152 setStatus({status:"error", error:"No Python runtime or bundled gateway found"})` |
| R3 | **配置热重载与启动 only 字段语义不一致的 API**：`config_router.py:263 /restart` 端点允许"自助重启"，但触发的是 `os.execvp(gunicorn-style)`，对 Windows/打包构建可能行为不一致；README 标注 dev/web 模式可用。 | `app/gateway/routers/config_router.py:155-208` |
| R4 | **登录 shell 环境继承可能泄露到子进程**：`backend.ts:722-775 loadLoginShellEnv` 把整个登录 shell 的 env 注入 gateway；任意含 `$VAR` 的 `$PATH` 之外的 `KEY` 都会进入 gateway 子进程，并通过 `os.environ` 暴露给工具脚本。无白名单——与 README 强调的"数据本地"基调有张力。 | `backend.ts:280-314 buildEnv` |
| R5 | **单端口 19987 + 18569 区分脆弱**：`isDesktopDevMode()` 通过 `window.location.port === 18569` 判断；但若用户改 NEXT_PORT 而 bridge 的 `frontendPort` 未传，会落入 `LEGACY_ELECTRON_DEV_PORT` 默认 18569 永远命中——伪装成 dev 模式。 | `frontend/src/core/config/index.ts:51-58, 68-73` |
| R6 | **`fetcher.ts:95-101` 的 `console.log("[DIAG:fetcher] ...")` 未下线**：每个 API 调用都打印一次，生产环境会污染日志、泄漏 URL/方法信息。 | `fetcher.ts:94-101` |
| R7 | **CSRF 对 Bearer 路径"完全豁免"的语义风险**：`csrf_middleware.py` 中 `is_auth_endpoint` 与 OAuth 回调也一并豁免；如果有人误用 Bearer 但实际是浏览器 cookie 路径（桌面 Web dev 模式），CSRF 中间件将放行——所有桌面 dev 模式的状态变更请求都失去 CSRF 保护，靠 Bearer 自身轮换抗重放。 | `app/gateway/csrf_middleware.py:64-80, 152` + `frontend/src/core/api/fetcher.ts:79-92` |
| R8 | **前端 threads/hooks.ts 体积膨胀**：单文件 1323 行，集成了 `useThreadStream`、`useThreadHistory`、`useThreads`、`useThreadRuns`、`useRunDetail`、`useDeleteThread`、`useRenameThread` 等；状态机 + 队列 + 重连 + 错误分类全部塞在一个文件——后续维护与单测拆分成本高。 | `frontend/src/core/threads/hooks.ts:1-1323` |
| R9 | **PyInstaller onedir 布局硬绑定 ms-playwright**：`backend.ts:322-329` 通过 `process.resourcesPath` 假设 Playwright Chromium 在 `_internal/ms-playwright`；若上游 Playwright 升级改路径，桌面端启动即失败。 | `desktop/backend-build/kworks-gateway.spec:43-48` |
| R10 | **`run_events.backend` 三态需要细心**：`runtime/runs/manager.py` 与 `_enforce_postgres_for_multi_worker` (`deps.py:64-116`) 严格区分 memory/jsonl/db，文档表面清晰但实际 docs 仍零散，分散在 Pyd  `description=` 注释里。 | `qilin/config/run_events_config.py`、`reload_boundary.py` |
| R11 | **网页版微信登录失败属于已知平台限制**（README 已知问题）+ PDF 内嵌渲染依赖 Chromium（个别文件落入错误态）+ 超大 XLSX/PPTX 卡顿 + Windows/Linux 安装包未本地签名——四项都对桌面单机"开箱即用"产生实际影响。 | `README.zh.md:82-87` |
| R12 | **`extensions_config.json` 双源一致性问题**：用户改 `extensions_config` 后不会自动 reload ChannelService（`reload_boundary.py:65-67` 列为 startup-only），需重启 gateway；而 `channels.*` 段位于 `config.yaml` 之外的 `extensions_config.json`，监控/审计面被分裂。 | `app/channels/service.py:155-159` + `reload_boundary.py:65-67` |
| R13 | **`local_sandbox_provider.py` LRU 缓存上限 256**：超过即丢 `agent_written_paths`，下次 `read_file` 无 reverse-resolve hint——线程数爆发（IM 渠道大量私聊）可能踩到。 | `qilin/sandbox/local/local_sandbox_provider.py:32 DEFAULT_MAX_CACHED_THREAD_SANDBOXES = 256` |
| R14 | **嵌入式终端 self-heal 权限打补丁**：`ipc.ts:119-168 ensureNodePtySpawnHelperExecutable` 在 pnpm 拿掉 +x 位时 chmod 0o755；属于静默修复，但意味着打包后 `spawn-helper` 权限位被破坏时也会自动 chmod——若上游 node-pty 升级改 spawn-helper 路径，self-heal 会失败并仅日志告警（`ipc.ts:156-167`），用户面对 `posix_spawnp failed.` 仍不知根因。 | `desktop/src/ipc.ts:155-168` |

---

## 6. architecture diagram

> 下面用文字描述三进程时序图；按"进程 + 协议"标注关键调用点。可用 Mermaid/draw.io 直接重画。

```
[User]
  │ click / input
  ▼
[Electron Main Process] ── spawn ──► [QiLin Gateway Process]
        │                                  │ FastAPI app.py
        │ contextBridge                     │ ├ AuthMiddleware
        ▼                                  │ ├ CSRFMiddleware
[Renderer Process] ◄──── IPC invoke ───────┤ ├ CORSMiddleware
        │                                  │ └ TraceMiddleware
        │ fetch(Bearer + CSRF)             │
        ▼                                  ▼
   /api/threads/{id}/runs/stream   ──►   thread_runs.router.stream_run
                                              │
                                              ▼
                                        RunManager.create → RunStore.put
                                              │
                                              ▼
                                        start_run → asyncio.Task
                                              │
                                              ▼
                                       worker.run_agent (qilin/runtime/runs/worker.py:568)
                                              │
                                              ▼
                                       graph.astream([values, updates, messages])
                                              │
                                              ▼
                                       StreamBridge.publish → asyncio.Queue
                                              │
                                              ▼
                                       SSE consumer (sse_consumer())
                                              │
                                              ▼
                                       StreamingResponse(body)
                                              │
        ┌─────────────────────────────────────┘
        │ HTTP/SSE chunks
        ▼
   useThreadStream (frontend/core/threads/hooks.ts:212)
        │
        ├ onUpdateEvent  → messages 增量
        ├ onToolEnd       → 工具状态
        └ onFinish        → 触发队列自动发送

# 旁支：
# (a) IM 渠道 → ChannelManager.dispatch → 同样的 runs/stream 路径（同一个 gateway）
# (b) ScheduledTaskService.poll → 同样的 runs/stream 路径（同一个 gateway）
# (c) MCP 调用 → MCPSessionPool → 工具 → graph 节点
```

---

## 7. 关键发现清单（按重要性降序）

- **A1.** 三层架构边界清晰、契约形式化：`contextBridge`（桌面↔渲染）+ `fetchWithAuth`（渲染↔网关）+ `runtime/runs` 抽象（网关↔引擎）。所有跨层调用都有中央包装，新增功能必须复用而不能绕过（违反会立刻暴露在 CSRF 或 cookie 缺失上）。
- **A2.** QiLin 引擎的"LangGraph 兼容 + 多部署形态"思路：默认 sqlite 单 worker 桌面单机，要切到多 worker / 多用户 / IM 渠道服务端时按 `database.backend=postgres` + `GATEWAY_WORKERS > 1` + `run_events.backend=db` + `run_ownership.heartbeat_enabled=true` 集合要求升级；缺一项 `_enforce_postgres_for_multi_worker` 直接 `SystemExit`。
- **A3.** StreamBridge + StreamEvent + StreamGap 设计完整支持 SSE 重连/追赶：`HEARTBEAT_SENTINEL`/`END_SENTINEL`/`StreamGap` 三种特殊事件（`base.py:48-50`）；订阅方给出 `requested_event_id` / `earliest_available_event_id` / `latest_available_event_id`，前端通过 `useStream({ reconnectOnMount })` 直接受益。
- **A4.** Run 心跳 + 租约 + 孤儿恢复 + takeover 是 QiLin 真正具备"多进程生产可用"的工程基石；见 `runtime/runs/manager.py:1700-1784 reconcile_orphaned_inflight_runs` + `claim_for_takeover` 的 SQL 条件 update 防 race。
- **A5.** 前端 desktop 三态分流（`isDesktop` / `isDesktopDevMode` / `isDesktopBackendManagedMode`）是桌面端所有跨层差异的根因；它决定了 base URL（`localhost` vs `127.0.0.1`）、`credentials` 策略、CSRF 是否注入。改任一处的判断会引发 Cookie 失效或 CSRF 风暴。
- **A6.** 配置热重载边界工程化：`qilin/config/reload_boundary.py` 集中枚举所有 startup-only 字段，每个字段的 `Field(description=...)` 用 `startup-only:` 前缀标识——未来改动这块的人必须两个地方同时改（双测覆盖）。
- **A7.** `desktop/src/frontend-protocol.ts` 的 RSC + 动态路由 fallback 是桌面打包版"切 tab 不掉 SSE"的关键：检测 `RSC: 1` header + 把所有 `[thread_id]` 强制映射到 `chats/new` 的 `__PAGE__.txt`，避免 Next.js 触发整页 reload。值得作为后续新动态路由的范式。
- **A8.** 引擎单例在 `app.state.*` 上挂载（`deps.py:538-614`）：所有 routers 通过 `_require("stream_bridge", ...)` getter 取，禁止缓存到模块全局——避免 reload 抖动。这一点是配置热重载可生效的前提。
- **A9.** Run + Checkpoint + Store + EventStore 全部走"接口抽象 + 默认实现 + SQL 实现"三层（`runtime/runs/store/base.py:44 RunStore` + `memory.py` + `RunRepository`）；做新后端（如 OpenSearch、Snowflake）只需新增 `RunStore` 子类，无需改 routers。
- **A10.** 跨进程鉴权三轨：
  - Web (cookie + CSRF)、Desktop managed (Bearer + CSRF-exempt)、Desktop dev (cookie + CSRF + Bearer 兜底)。任何"我只测了 web"的改动都需要重新跑 desktop dev + managed 两条路径。
- **A11.** Subagent 并行基座 + 失败隔离：`subagents/batch.py:34 run_batch_async` + `asyncio.Semaphore` + 异常吞咽 → FAILED 状态（不抛）——配合 `orchestrator_workers` / `peer_consensus` 形成完整多 agent 模式。
- **A12.** 工具/沙箱边界硬化：`Sandbox.execute_command` 在抽象层 `sandbox.py:17-41 _validate_extra_env` 强制 POSIX env-var 名格式，防止未来某个 sandbox 实现切回 shell-splicing 时被命令注入。这是"未来兼容性防御"的范例。
- **A13.** 风险 Top-3 治理建议：
  - 立即下线 `fetcher.ts:95-101` 的 `[DIAG:fetcher]` console.log；
  - 收敛 `desktop/types.ts` 与 `preload.ts` 接口对齐（删除 `getStartupInfo` 等残留）；
  - 引入 `extensions_config.json` reload-friendly 替代方案或在文档明确"修改后需重启"。

---

> 本报告阅读路径建议：
> 1. 先看 §0（顶层图）+ §3.1（配置清单）+ §3.2（启动顺序）；
> 2. 再看 §1.2（三类协议）与 §4（可替换点）以理解边界；
> 3. 排查或新功能前必读 §2（依赖方向）+ §5.1/§5.2（亮点 vs 风险）。