# KWorks 研究报告（只读调研）

> 调研对象：`/Users/libing/kk_Projects/KWorks`（v1.0.7，main 分支 working tree clean）
> 子代理角色：只读调研（无修改/构建/测试/push/install）
> 报告生成日期：基于仓库当前快照
> 调研口径：广度 grep + 关键文件深度读，AGENTS.md 强制中文报告，代码/路径/报错原样

---

## 项目快照（已知基线，验证后追加）

| 项 | 值 | 来源 |
| --- | --- | --- |
| KWorks 版本 | v1.0.7（`chore(release): v1.0.7` commit `a33a162`） | `git log` |
| QiLin 子模块 | 7c1ba94 `feat(worker): auto-resume runs after recursion_limit` | `qilin/` |
| qilin 包版本 | 2.0.0（PyPI: qilin） | `qilin/pyproject.toml` |
| Python 依赖 | `requires-python = ">=3.12"` | `qilin/pyproject.toml` |
| Node 依赖 | `electron@^33.2.0`、`electron-builder@^25.1.8`、`next@^16.1.7`、`react@19.2.x`、`pnpm@10.26.2` | `desktop/package.json`、`frontend/package.json`、workflow |
| gateway 默认端口 | `19987`（区别 web 部署 `9987`） | `desktop/src/backend.ts:54` |
| gateway host | `127.0.0.1`（仅 loopback，永不外露） | `desktop/src/backend.ts:56` |
| gateway 启动方式 | 三级回退：bundled exe → `uv run python -m uvicorn app.gateway.app:app` → 系统 python | `desktop/src/backend.ts:216-249` |
| config_version | `32` | `qilin/config.example.yaml:18`、打包态 `desktop/resources/gateway/_internal/config.embedded.yaml` |
| desktop 隔离 | `~/.kworks`（非 Electron userData） | `desktop/src/paths.ts:91-105` |
| legacy 数据迁移 | `~/.oclaw` / `<userData>/.kkoclaw` → `~/.kworks`，`.migrated_v3` 哨兵 | `desktop/src/backend.ts:533-601` |
| 鉴权 JWT | 32 字节随机，`<QILIN_HOME>/.auth_jwt_secret` 持久化（restart 不失效） | `desktop/src/backend.ts:785-810` |
| CSRF | Double Submit Cookie（`csrf_token` + `X-CSRF-Token`），Bearer 跳过 | `qilin/app/gateway/csrf_middleware.py` |
| Alembic 迁移 | 10 个 revision（`0001_baseline` → `0010_run_cancel_request`） | `qilin/persistence/migrations/versions/` |
| 测试覆盖（qilin） | 32 个文件，519 个测试函数 | `qilin/tests/` |

---

## A. 模块依赖图 + 数据契约

### A.1 三顶层布局

```
KWorks/
├── desktop/         # Electron 33 主进程（TS） + preload CJS + IPC + PyInstaller spec
│   ├── src/        12 个 TS 文件（main.ts:701 / backend.ts:884 / ipc.ts:449 / paths.ts:251
│   │              / preload.ts:222 / updater.ts:389 / config-migration.ts:240
│   │              / skill-models-env.ts:310 / frontend-protocol.ts:192
│   │              / logger.ts:83 / url-policy.ts:25 / shutdown.ts:23）
│   ├── tests/      16 个 .test.mjs（node --test 风格，覆盖 backend-lifecycle /
│   │              config-migration / shutdown / single-instance / url-policy / window-security 等）
│   ├── scripts/    dev.mjs / build-gateway.sh / run_gateway.py / verify-package-resources.mjs /
│   │              fix-node-pty-permissions.mjs / generate-icons.sh
│   ├── backend-build/  kworks-gateway.spec（PyInstaller onedir）
│   └── resources/gateway/   打包态 gateway 落点（含 _internal/skills/builtin）
├── frontend/       # Next 16.1.7 + React 19 静态导出（pnpm-workspace 单包）
│   ├── src/core/   api/auth/agents/memory/skills/threads/uploads/desktop/...
│   ├── src/components/    workspace / settings / skill-config ...
│   ├── tests/unit/  49 个业务 .test.ts/.tsx + setup.ts
│   └── tests/e2e/   6 个 playwright spec（baseURL=http://localhost:9192）
└── qilin/          # Git submodule（git@github.com:kkutysllb/QiLin.git）
    ├── app/gateway/    FastAPI app.py:694 + 25 个 routers + 4 个 middleware
    ├── qilin/         Python 引擎包（30+ 子模块）
    ├── persistence/migrations/versions/   10 个 Alembic 迁移
    └── pyproject.toml    qilin 2.0.0
```

### A.2 desktop ↔ gateway ↔ frontend 三方契约

**渲染层 → 桌面主进程（IPC channel 桥）**
- `window.kworksDesktop`（`desktop/src/preload.ts:90-221`，contextBridge 暴露）
- 实际 IPC 通道：`backend:get-status | start | stop | restart | get-logs | get-gateway-config`、`dialog:pick-files | pick-directory`、`shell:open-external | open-folder`、`terminal:start | write | resize | stop`、`updater:check | install`、`skill-models:get | set`、`desktop:file-drop`（推送）、`menu:check-update`（推送）、`updater:downloading | ready`（推送）、`terminal:data | exit`（推送）
- 类型镜像：`frontend/src/core/desktop/types.ts` 与 `desktop/src/preload.ts` 字段一一对应（开发期需手工同步，**未走 codegen**）

**桌面主进程 → gateway 子进程（subprocess）**
- `BackendManager`（`desktop/src/backend.ts:94`）EventEmitter 状态机：`stopped → starting → running | error → stopped`
- env 注入（`buildEnv`，`:270-339`）：`QILIN_HOME | QILIN_HOST_BASE_DIR | QILIN_CONFIG_PATH | QILIN_EXTENSIONS_CONFIG_PATH | QILIN_SKILLS_PATH | GATEWAY_CORS_ORIGINS=app://- | CORS_ORIGINS=app://- | AUTH_JWT_SECRET | GATEWAY_HOST=127.0.0.1 | GATEWAY_PORT | GATEWAY_LOG_LEVEL=debug | PYTHONUNBUFFERED=1 | PYTHONDONTWRITEBYTECODE=1 | PLAYWRIGHT_BROWSERS_PATH`
- 启动顺序（`BackendManager.launch`，`:126-186`）：`migrateLegacyUserData → ensureDataDirs → initConfig → migrateConfig → initExtensionsConfig → initSkillModelsEnv → initSkills → openLogStream → resolveCommand → spawn → wireProcessIO → startHealthMonitor`
- 健康检查（`checkHealth`，`:440-448`）：`fetch('http://127.0.0.1:<port>/health', { signal: AbortSignal.timeout(2000) })`，间隔 500ms，超时 120s
- 关闭（`killProcess`，`:459-514`）：Win32 走 `taskkill /pid /f /t`（2s 超时）；Unix 走 `SIGTERM → SIGKILL`（500ms 升级）

**gateway → 前端（HTTP/SSE）**
- CORS 允许 origin：来自 `GATEWAY_CORS_ORIGINS`（桌面端固定 `app://-`），CSRF 双提交 + auth_exempt 集合（`qilin/app/gateway/csrf_middleware.py:64-71`：`/api/v1/auth/{login/local,logout,register,initialize}`）
- 21 个 routers 全部列在 `app.py:578-666`，每路由前缀见 §C
- Bearer 跳过 CSRF（`:244-256`）—— 桌面 `app://` 同源 cookie 不可用，故统一走 Bearer；dev 同源 cookie + CSRF 双提交

### A.3 QiLin 内部数据契约

**Agent 装配链**
- `qilin.agents.factory.create_qilin_agent(model, tools, ..., features: RuntimeFeatures, ...)` → 调用 `_assemble_from_features(feat)` 装配 14 个内置 middleware（顺序固定，见 `qilin/qilin/agents/factory.py:226-372`）：
  1. `ThreadDataMiddleware`(lazy)  2. `UploadsMiddleware`  3. `SandboxMiddleware`(lazy)
  4. `DanglingToolCallMiddleware`(always)  5. `GuardrailMiddleware`(if feat.guardrail)
  6. `ToolErrorHandlingMiddleware`(always)  7. `SummarizationMiddleware`(custom 实例)
  8. `TodoMiddleware`(if plan_mode)  9. `TitleMiddleware`  10. `MemoryMiddleware`
  11. `ViewImageMiddleware` + `view_image_tool`  12. `SubagentLimitMiddleware` + `task_tool`
  13. `LoopDetectionMiddleware`  14. `TokenBudgetMiddleware`  15. `ClarificationMiddleware` + `ask_clarification_tool`
- 通过 `@Next`/`@Prev` 装饰（`@Next(anchor)` / `@Prev(anchor)`）插入自定义 middleware（`_insert_extra`，`:391-464`）；冲突/不可解析锚点抛 `ValueError`
- 应用层入口：`qilin.agents.lead_agent.agent._make_lead_agent(config, app_config)`（`:677-974`）调用 `build_middlewares(...)`，再 `create_agent(...)`（langchain 内置）
- 关键不变量（`agent.py:1-23`）：所有 `create_chat_model(...)` 必须传 `attach_tracing=False`，否则双重 span + Langfuse session/user 失效

**OrchestrationGraph 多 agent 拓扑**
- `qilin.orchestration.graph.OrchestratorGraph`（`graph.py:49-161`）：
  - 节点：`orchestrator` + N 个 worker（每个 worker 节点 = `_make_worker_node(name)`）
  - 边：`START → orchestrator`；`orchestrator → worker(name)` 条件路由；每个 `worker → orchestrator`
  - 状态：`OrchestrationState` 含 `handoffs: list[AgentHandoff]`（FIFO）+ `results: list[HandoffResult]` + `active_handoff` + `round`/`max_rounds`
  - `max_rounds=10`、`max_concurrency=3`（默认；patterns 层用）；worker 用 `executor_factory(spec)._aexecute(active.task)`（`_SubagentExecutor` Protocol）
  - 失败隔离：worker 异常被吞进 `HandoffResult(success=False, error=str(exc))`
- Handoff 数据结构（`qilin/orchestration/handoff.py`）：
  - `AgentHandoff(from_agent, to_agent, task, context={}, result=None)`；`inherit_trace_id()` 从 `qilin.trace_context.get_current_trace_id()` 取 ambient trace；context 已含 trace 时不覆盖
  - `HandoffResult(success, result=None, error=None, handoff=None, trace_id=None)`
- 收件箱（`qilin/orchestration/inbox.py`）：`AgentInbox` = per-agent `asyncio.Queue` + subscribers；`send / receive / subscribe / close`；订阅者异常隔离（`logger.exception`）；`close()` 后 send 抛 `HandoffError`
- 协作模式（`qilin/orchestration/patterns.py`）：
  - `orchestrator_workers(specs, task, executor_factory, max_concurrency=3)`：并行（复用 `subagents.batch.run_batch_async`，失败隔离），返回 `{name: SubagentResult}`
  - `peer_consensus(specs, task, ..., min_agreement=0.6)`：达成阈值返回 `(consensus_text, agreements, total)`，否则 `(None, agreements, total)`
- Graph 缓存：`qilin.agents.lead_agent.orchestration_cache.FingerprintedGraphCache[T]`（`orchestration_cache.py:45-93`）
  - 单入口 `get_or_build(key, fingerprint, builder)`；key = `(model_name, resolved_user_id, id(resolved_app_config))`（来自 `agent.py:760`）
  - `fingerprint` 来自 `app_config.orchestration.graph_fingerprint()`
  - `_DEFAULT_MAX_ENTRIES=8`；**超限时 `_entries.clear()`（不是 LRU）**—— `:81-83`
  - 双层失效保护：AppConfig id 在 key 中 + fingerprint 捕捉 in-place 变更；保证 hot-reload 后图不会用过期的 executor factory closure
- 单 agent 模式 v1 graph：仍走 `create_agent(...)` + `build_middlewares(...)`（`agent.py:944-974`），不被 fingerprint 缓存

**Run 生命周期（核心管道）**
- `qilin.runtime.runs.manager.RunManager`（2254 行）：注册/孤儿恢复/lease 过期处理；`_is_unique_violation` 通过驱动原生 `pgcode` / `sqlstate` / `sqlite_errorcode` + message 兜底检测唯一冲突（`:60-112`）；重试 SQLite BUSY/LOCKED（`_RETRYABLE_SQLITE_MESSAGES` / `_ERROR_CODES`）
- `qilin.runtime.runs.worker.run_agent_background`（worker.py 2402 行）：在 asyncio.Task 内跑 `graph.astream(stream_mode=[...])`，写入 `StreamBridge`；**`events` 模式被显式拒绝**（`worker.py:9-14`：与 `values` 不能并存，LangGraph Python 公共 API 不暴露）
- 检查点锁（worker.py:96-115）：`_checkpoint_locks_by_loop: weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, dict[str, asyncio.Lock]]`，per-thread 串行 checkpoint mutation
- `SubagentStatus`（executor.py:56-73）：`PENDING|RUNNING|COMPLETED|FAILED|CANCELLED|TIMED_OUT`；`try_set_terminal()` 保证终态只写一次（race-safe，`_state_lock: threading.Lock`）
- `SubagentResult`（executor.py:77-159）：含 `task_id`、`trace_id`、`status`、`result`、`error`、`stop_reason`、`started_at`、`completed_at`、`ai_messages`、`token_usage_records`、`usage_reported`、`cancel_event: threading.Event`
- 隔离 subagent loop（executor.py:50-53）：`_shutdown_isolated_subagent_loop` 通过 `atexit.unregister` 注销前一个实例化（**冷热更新时多次初始化**的安全保护）
- `QILIN_HOME` / `QILIN_HOST_BASE_DIR` / `QILIN_CONFIG_PATH` / `QILIN_EXTENSIONS_CONFIG_PATH` / `QILIN_SKILLS_PATH` / `QILIN_PROJECT_ROOT`（仅 dev）—— **desktop 必传；打包态不得传 `QILIN_PROJECT_ROOT`**，否则 PyInstaller bundle 解析失败（backend.ts:332-336）

**前端 / 后端共享事件类型**
- 后端 SSE custom event（`qilin/qilin/tools/builtins/task_tool.py` 与 `qilin/agents/middlewares/llm_error_handling_middleware.py`）：
  - `task_started | task_running | task_completed | task_failed | task_cancelled | task_timed_out`（task_tool.py）
  - `subagent_limit_truncated`（subagent_limit middleware）
  - `llm_retry`（llm_error_handling middleware）
- 前端消费（`frontend/src/core/threads/stream-event-handler.ts:68-202`）：纯函数 `handleStreamEvent(event, deps)`；仅覆盖 7 类，其余忽略（forward-compatible）
- 类型映射（`frontend/src/core/threads/run-events-api.ts:5-29`）：`SubagentStepEvent { event_type: "subagent.start" | "subagent.step" | "subagent.end", category?, content: {task_id, message_index?, kind: "ai"|"tool", text?, tool_name?, tool_calls?, status?, model_name?, usage?, result?, error?, ...}, metadata, created_at? }`

**Alembic 迁移表清单**
- `qilin/persistence/migrations/versions/`：10 个 revision —— `baseline → runs_token_usage → scheduled_tasks → run_ownership → run_stop_reason → agents → scheduled_run_active_index → thread_operation_kind → webhook_dedupe → run_cancel_request`
- env.py 显式排除 LangGraph 自管表（`checkpoints / checkpoint_blobs / checkpoint_writes / checkpoint_migrations`）
- 默认 URL：`sqlite+aiosqlite:///./data/qilin.db`（仅供 offline/autogenerate）；runtime 通过 `qilin.persistence.engine.get_session_factory()` 注入（env.py:88-104 给 alembic 自身连接的 `PRAGMA busy_timeout=30000`）

### A.4 配置/数据契约边界

- **desktop 不读 qilin 仓库根配置**：`QILIN_CONFIG_PATH` 强制指向 `<QILIN_HOME>/config.yaml`，模板首次启动从 `getBundledConfigTemplatePath()` 拷贝（`paths.ts:235-249`；模板源 `desktop/backend-build/config.embedded.yaml` 与 `desktop/resources/gateway/_internal/config.embedded.yaml` 同源，bundled gateway 内置 `_internal/` 一份）
- **extensions 隔离**：`QILIN_EXTENSIONS_CONFIG_PATH` 强制 `<QILIN_HOME>/extensions_config.json`，首次启动写 `{"mcpServers":{}, "skills":{}}`（backend.ts:650-666）；仓库根 `qilin/extensions_config.example.json` 被打包进 gateway 但不被 desktop 读
- **skills 隔离**：`QILIN_SKILLS_PATH = <QILIN_HOME>/skills`；首次启动从 `getBundledBuiltinSkillRoots()` 拷贝（`public/` 子目录，按 `builtin/core` + `builtin/task` 优先，legacy `public/` 回退）；用户自定义写入 `custom/`（backend.ts:826-876）；**已存在的同名技能不被覆盖**（`:857`）

---

## B. 测试盲点

### B.1 总体盘点

| 区域 | 测试文件数 | 测试函数数 | 覆盖文件比例（粗估） |
| --- | --- | --- | --- |
| `qilin/tests/`（顶层 25 + 子目录 7） | 32 | 519 | engine 模块 ≈ 50% |
| `frontend/tests/unit/` | 49 业务 + 1 setup | — | core 模块集中，components 仅 6 |
| `frontend/tests/e2e/` | 6 | — | 5 用户路径 + utils |
| `desktop/tests/` | 16 | — | 仅 .test.mjs 集成测试 |

### B.2 关键盲点（grep 反向匹配）

**完全无测试覆盖的目标（grep 命中率为 0）：**
- `qilin/qilin/sandbox/file_operation_lock.py`（WeakValueDictionary + threading.Lock，27 行）—— 无对应 test_lock 文件
- `qilin/app/gateway/csrf_middleware.py`（Double Submit Cookie + 304 行）—— 仅 `test_*` 命中但都不是 csrf 主题
- `qilin/qilin/agents/lead_agent/orchestration_cache.py`（FingerprintedGraphCache）—— 无 test 文件
- `qilin/qilin/skills/skillscan/orchestrator.py`（skill 扫描编排）
- `qilin/qilin/skills/review/{analyzer,resource_graph,cli}.py`（skill review 工具链）
- `qilin/qilin/runtime/stream_bridge/{redis,memory,base}.py`（除 base 之外）
- `qilin/qilin/mcp/{cache,session_pool,oauth}.py`（MCP session/oauth 池）
- `qilin/qilin/community/{aio_sandbox,boxlite,e2b_sandbox,image_search,jina_ai,tenki,warm_pool_lifecycle}` —— 沙箱/搜索集成几乎无单测
- `qilin/qilin/runtime/store/{async_provider,provider,_sqlite_utils}.py` —— SQLite runtime store 自身
- `qilin/qilin/runtime/checkpointer/{async_provider,provider}.py` —— langgraph checkpointer 适配层

**subagent_executor 自身盲点：**
- `qilin/qilin/subagents/executor.py`（1281 行，12 个公开/内部函数）**未在 tests/test_subagent_executor.py 中**；仅有 `tests/test_subagent_batch.py`（仅覆盖 batch.run_batch_async）
- 隔离 loop / `_shutdown_isolated_subagent_loop` / `_submit_to_isolated_loop_in_context` / `cancel_event` race 行为均无测试
- `_extract_final_result`（`:161-200` 之后的 fallback 路径）在 hit-recursion_limit 后的部分恢复路径（worker.py 引用 #3875 Phase 2）单测不充分

**gateway 路由盲点（按 endpoint 数 vs 测试文件数对比）：**
| router | endpoints | 测试存在？ |
| --- | --- | --- |
| `thread_runs` | 19 | `tests/test_runtime_core.py` 间接覆盖 |
| `threads` | 13 | 无独立测试 |
| `skills` | 12 | 无 |
| `scheduled_tasks` | 10 | `tests/test_scheduler_schedules.py` |
| `memory` | 10 | `tests/agents/memory/test_qilinmem_*.py` |
| `auth` | 10 | 无 | 
| `agents` | 10 | 无 | 
| `console` | 3 | `tests/test_console.py` 缺失？ |
| `runs` (stateless) | 4 | 无 |
| `artifacts` | 1 | 无 |
| `datasources` | 6 | `tests/test_datasources.py` 缺失？ |
| `feedback` | 6 | 无 |
| `channels` / `channel_connections` | 6+2 | 无 |
| `config_router` | 4 | `tests/test_config_router_helpers.py` + `test_extensions_config_write.py` + `test_orchestration_config.py` |
| `persistence` | 2 | 无 |
| `browse` / `input_polish` / `features` / `suggestions` | 各 1-2 | 无 |

注：router endpoint 数由 `grep -cE "^\s*@router\." qilin/app/gateway/routers/<name>.py` 估算；`threads.py` 和 `config_router.py` 内的辅助函数（含 `run_id_prefix=`）被一并计入。

**desktop 端盲点：**
- `desktop/tests/` 16 个 `.test.mjs`（`backend-lifecycle / config-migration / desktop-config / dev-backend-ownership / dev-launcher / frontend-protocol / multi-window / no-reuse-web-service / node-pty-spawn-helper / open-terminal / package-build / release-lifecycle-script / shutdown / single-instance / url-policy / window-security`）—— 已较全面
- 但 `loadLoginShellEnv`（`backend.ts:722-775`）的 macOS GUI shell env 继承路径无直接 e2e 验证
- `migrateLegacyUserData` 的 3 选项对话框路径（`backend.ts:559-570`）只能靠手动触发
- `Squirrel.Mac` 安装时跳过完整 before-quit 的特殊路径（`main.ts:675-679`）依赖非 Mac 平台不验证

**frontend 盲点：**
- 业务 src 437 个文件，单元测试 49 + e2e 6 覆盖；
- 缺失覆盖：`src/core/persistence/*`（persistence 客户端）、`src/components/settings-config/*` 复杂配置页、`src/components/skill-config/*` 技能配置 UI、`src/core/tasks/*` 任务队列、`src/core/clipboard.ts`、`src/core/notification/*` 等
- 仅 6 个 e2e spec：chat/agent-chat/landing/settings-config-layout/sidebar/thread-history —— 缺 `run-events-feedback`、`integrations`、`memory`、`config-edit`、`agents-page` 的端到端路径
- `playwright.config.ts`：baseURL=http://localhost:9192，`SKIP_ENV_VALIDATION=1`，`KWORKS_AUTH_DISABLED=1`（dev mode 无 CSRF）；CI 命令 `pnpm build && pnpm start`

### B.3 TODO/FIXME 残留

| 区域 | 命中 | 实际业务 TODO 数 |
| --- | --- | --- |
| `qilin/qilin/` + `qilin/app/` | 3 | 0（全部是 `_TODO_SYSTEM_PROMPT / _TODO_TOOL_DESCRIPTION` 模板字符串 + `TodoMiddleware` 注册，命名巧合） |
| `frontend/src/` | 11 | 11（10 个在 `core/skills/templates.ts` 是模板占位文案；1 个在 `components/workspace/input-box.tsx:558` 是 connector 占位） |
| `desktop/src/` | 1 | 0（grep 命中但属注释） |

无业务 TODO；但说明 `core/skills/templates.ts` 的模板尚未实际使用（仅占位），发布前可考虑删除或落地。

### B.4 测试自动化盲点（CI 缺口）

- `release.sh:483-484`：`run_shell "frontend tests" "cd frontend && pnpm exec vitest run --exclude tests/unit/core/thread-stream-cache.test.ts"`，thread-stream-cache 在本地 V8 abort（happy-dom fork worker）；**CI 不跑 frontend 单元测试**（这条注释明确写："CI does not run unit tests"）
- `release.sh:478`：qilin 测试只跑 import smoke（`uv run python -c 'import qilin; import app.gateway.app'`），全量 pytest 仅在 `--full-tests` 标志下
- desktop `lint` = `tsc --noEmit` 两次，不做 eslint
- 真正的多平台矩阵测试在 `release-desktop.yml`（Ubuntu 22.04 / macOS-latest / windows-latest）跑 `build:app` 全流程

---

## C. IPC / Event / Service 拓扑

### C.1 desktop IPC（preload contextBridge）

来源：`desktop/src/preload.ts:90-221` ↔ `desktop/src/ipc.ts:286-424` ↔ `desktop/src/main.ts:594-639`（注册）

| 类别 | invoke（renderer → main） | send/once（main → renderer） |
| --- | --- | --- |
| Backend 生命周期 | `backend:get-status`、`backend:start`、`backend:stop`、`backend:restart`、`backend:get-logs`、`backend:get-gateway-config` | `tray` 状态变更走 `backend.onStatusChange`（不在 IPC） |
| 文件对话框 | `dialog:pick-files (options)`、`dialog:pick-directory (options)` | `desktop:file-drop`（main 监听 OS drop） |
| 系统集成 | `shell:open-external (url)`、`shell:open-folder (folderPath)`、`terminal:start / write / resize / stop`、`updater:check`、`updater:install` | `menu:check-update`、`updater:downloading`、`updater:ready`、`terminal:data`、`terminal:exit` |
| Skill 模型凭证 | `skill-models:get`、`skill-models:set (updates)` | — |

renderer `window.kworksDesktop.gatewayPort` 在 preload 中硬编码 `19987`，renderer 启动时调 `initGatewayPort()` 异步覆盖。

### C.2 gateway middleware 顺序

`qilin/app/gateway/app.py:546-575`：
1. **AuthMiddleware**（fail-closed，公共路径前缀白名单见 `auth_middleware._PUBLIC_PATH_PREFIXES`）
2. **CSRFMiddleware**（Double Submit Cookie + Bearer 跳过；`should_check_csrf` 仅检查 `POST/PUT/DELETE/PATCH`，豁免 `/api/v1/auth/me`、`/api/webhooks/*`）
3. **CORSMiddleware**（仅当 `GATEWAY_CORS_ORIGINS` 非空；`allow_credentials=True`、`expose_headers=["Content-Location"]`）
4. **TraceMiddleware**（依 `logging.enhance.enabled` 配置；构造期 snapshot，避免 live toggle 不一致）

中间件顺序敏感：Auth 在 CSRF 之前（401 先于 403），CORS 最后（包住所有响应头）。

### C.3 gateway routers（21 个）

`app.py:578-666` 顺序 + 每文件 prefix（`grep APIRouter prefix=`, 详见 §A.2）：

| # | router file | prefix | endpoints | 备注 |
| --- | --- | --- | --- | --- |
| 1 | `models.py` | `/api` | 5 | chat models |
| 2 | `features.py` | `/api` | 1 | feature flags |
| 3 | `console.py` | `/api/console` | 3 | 跨 thread 可观测 |
| 4 | `mcp.py` | `/api` | 4 | MCP 配置 |
| 5 | `memory.py` | `/api` | 10 | 全局 memory |
| 6 | `skills.py` | `/api` | 12 | 技能启用/查询 |
| 7 | `integrations.py` | `/api/integrations` | 6 | first-party |
| 8 | `artifacts.py` | `/api` | 1 | `/threads/{thread_id}/artifacts` |
| 9 | `browser.py` | `/api` | 2 | `/threads/{thread_id}/browser` |
| 10 | `uploads.py` | `/api/threads/{thread_id}/uploads` | 4 | 含 staging |
| 11 | `threads.py` | `/api/threads` | 13 | cleanup |
| 12 | `scheduled_tasks.py` | `/api` | 10 | scheduler |
| 13 | `agents.py` | `/api` | 10 | custom agents |
| 14 | `suggestions.py` | `/api` | 2 | `/threads/{thread_id}/suggestions` |
| 15 | `input_polish.py` | `/api` | 1 | input polishing |
| 16 | `channel_connections.py` | `/api/channels` | 6 | 用户面 IM 连接 |
| 17 | `channels.py` | `/api/channels` | 2 | 频道管理 |
| 18 | `assistants_compat.py` | `/api/assistants` | 4 | LangGraph 平台兼容 stub |
| 19 | `auth.py` | `/api/v1/auth` | 10 | 本地/OIDC |
| 20 | `feedback.py` | `/api/threads` | 6 | `/threads/{id}/runs/{id}/feedback` |
| 21 | `thread_runs.py` | `/api/threads` | 19 | LangGraph 兼容 runs 生命周期 |
| 22 | `config_router.py` | `/api/config` | 4 | 配置读写 |
| 23 | `datasources.py` | `/api/datasources` | 6 | 凭证 |
| 24 | `persistence.py` | `/api/persistence` | 2 | status |
| 25 | `runs.py` | `/api/runs` | 4 | stateless runs |
| 26 | `github_webhooks.py` | `/api/webhooks` | 1 | fail-closed（仅 secret 配置） |

### C.4 gateway lifespan 钩子顺序

`qilin/app/gateway/app.py:200-447`：

启动（按序）：
1. `get_app_config()` → `configure_logging`
2. `ensure_browser_runtime_available`
3. `setup_monocle_tracing_if_enabled`（observability，失败不致命）
4. 后台启动：`_warm_memory_retrieval(manager)`（asyncio task 异步）
5. `manager.warm()`（tiktoken encoding 缓存，5s 超时；char-mode backend 自动跳过）
6. `cleanup_stale_upload_staging_files`
7. `langgraph_runtime(app, startup_config)`（async with）：装配 stream_bridge / RunManager / checkpointer / store
8. `_ensure_admin_user(app)`：首启走 `/setup` 提示；非首启做 LangGraph store 孤儿 thread 迁移（cursor pagination；无 orphans 跳过）
9. `start_channel_service(startup_config, get_stream_bridge=lambda: ...)`（无 IM channels 时 noop）
10. `ScheduledTaskService.start()`（仅当 scheduler.enabled）

关闭（按序）：
1. `auth.close_oidc_service()`
2. `stop_channel_service()`（bounded 5s）
3. `app.state.scheduled_task_service.stop()`
4. `get_browser_session_manager().close_all_sessions()`（bounded 5s）
5. `manager.shutdown_flush(timeout)` + `manager.close()`（K8s `terminationGracePeriodSeconds` 必须 > 此 flush）

`_SHUTDOWN_HOOK_TIMEOUT_SECONDS = 5.0`（统一上限）；`_RETRIEVAL_WARM_SHUTDOWN_TIMEOUT_SECONDS = 1.0`（derived state 可重建）。

### C.5 desktop 内部 EventEmitter / 监听

- `BackendManager`：`on('status', listener)` → `onStatusChange(listener)`（main.ts:620）
- `Menu.setApplicationMenu(buildAppMenu())` + `tray.setContextMenu(buildTrayMenu(status))` 双向同步
- `app.on("second-instance")` → `handleSecondInstance()` → `showLastActiveWindow()`（`:641-645`）
- `app.on("before-quit")` → 守卫 `isShuttingDown`、Squirrel.Mac 特殊路径、3s timeout
- `webContents.on("console-message")` → `appendRendererLog`（renderer.log）

### C.6 desktop main ↔ tray ↔ window 交互

- `appWindows: Set<BrowserWindow>`、`lastActiveWindow: BrowserWindow | null`
- `nativeTheme.themeSource = "dark"`（强制 dark 标题栏）
- `powerSaveBlocker.start("prevent-app-suspension")`（仅 darwin）
- `getMostRecentWindow()` 优先级：focused → lastActive → 最后一个未销毁
- `isQuitting` 守卫：hide-to-tray 时 `e.preventDefault()`，tray "退出" 时 `app.quit()` 走 Squirrel 完整生命周期

---

## D. 配置 / 迁移 / 部署

### D.1 config.yaml 版本与升级

- `config_version: 32`（`qilin/config.example.yaml:18`，与 `desktop/resources/gateway/_internal/config.embedded.yaml:24` 一致）
- `desktop/src/config-migration.ts` 桌面侧增量迁移（三步）：
  1. `replaceOrAppendAgentsApi`：保证 `agents_api.enabled: true`（无值追加；多值删后追加）
  2. `replaceOrAppendDesktopDatabase`：把 `database` section 改为 `backend: sqlite` + `sqlite_dir: <HOME>/.kworks/data`（绝对路径！），跨 revision 重新对齐 `backend` 和 `sqlite_dir` 的相邻位置（仅当中间是注释/空行才挪动）
  3. `replacePristineCommunityBrowserTools`：byte-exact 匹配 `PRISTINE_COMMUNITY_BROWSER_BLOCK`（v1.0.5 嵌入版本）→ 替换为 `NATIVE_BROWSER_TOOLS_BLOCK`（v1.0.6+ 的 `qilin.tools.builtins.browser_tools` 三件套）；**用户改过的块不替换**（用 sentinel）
- `migrateConfig()` 调用点：`backend.ts:632-648`（每次 launch 调用；写回原文件）

### D.2 数据迁移

- 用户数据：`<userData>/.kkoclaw` (Tauri 时代) → `~/.kworks`；过渡态 `~/.oclaw` 优先
- 哨兵文件：`<HOME>/.kworks/.migrated_v3`；choice 0=migrated、choice 1=skipped、choice 2=不写（下次再问）
- SQLite db：默认 `<HOME>/.kworks/data/qilin.db`（desktopSqliteDir 计算）；迁移时绝对路径写入 `database.sqlite_dir`
- 用户工作区：`<HOME>/.kworks/threads/`（subdir 在 `ensureDataDirs` 创建）

### D.3 release.sh 流程（782 行）

关键阶段：
- `update_versions()`（`:353-398`）：更新 `frontend/package.json` + `desktop/package.json` 的 `version` 字段；**不写入 qilin/pyproject.toml**（子模块独立版本控制）
- `refresh_lockfiles()`：pnpm `--lockfile-only --ignore-scripts`
- `generate_changelog()`：从上一个 tag 到现在 `git log --pretty=format:'- %s (%h)'`；无变更时占位 "Version metadata update"
- `run_checks()`：
  - 默认：qilin `import qilin; import app.gateway.app` + frontend vitest（排除 thread-stream-cache）+ typecheck + desktop lint + `node --test tests/package-build.test.mjs tests/release-lifecycle-script.test.mjs` + `verify:package-resources:source`
  - `--full-tests`：qilin 全量 pytest
- `commit_and_tag()`：`chore(release): $TAG`，annotated tag `v$VERSION`
- `push_release()`：原子推分支+tag；可选 `--watch` 等 GitHub Actions 完成
- 工作流：`.github/workflows/release-desktop.yml`（v* tag 触发）→ Ubuntu 22.04 / macOS-latest / windows-latest 三矩阵构建

### D.4 部署 / 打包

**PyInstaller 打包（`desktop/scripts/build-gateway.sh` + `kworks-gateway.spec`）**
- onedir 模式：`dist/kworks-gateway/{kworks-gateway(.exe), _internal/}`
- datas 收集（spec）：
  - `skills/public/` → `_internal/skills/public/`（legacy 布局，desktop initSkills 兼容）
  - `desktop/backend-build/config.embedded.yaml` → `_internal/config.embedded.yaml`
  - `qilin` 包内 `persistence/migrations/**` + `skills/storage/**`（必须显式 collect_data_files + includes）
  - `qilin.agents.memory.backends.qilinmem`（YAML 数据）
  - `app` 包
  - `qilin/extensions_config.example.json`
- **Playwright Chromium 不进 datas**（PyInstaller COLLECT 会破坏 Mach-O），而是 build 完成后由 `build-gateway.sh` 拷贝到 `_internal/ms-playwright/`
- macOS 预签：`APPLE_SIGNING_IDENTITY` 来自 GH secrets；CI 预签 gateway 内嵌 Mach-O，否则公证 HARDFAIL

**electron-builder 配置（`desktop/electron-builder.yml`）**
- `appId: com.kworks.desktop`、`productName: KWorks`
- `npmRebuild: false`（node-pty@1.1.0 预编译覆盖 Electron 33 ABI 130，避免 Python ≥3.12 distutils 缺失）
- `extraResources`：`resources/gateway/`、`../frontend/out`、`build/tray-icons/`、`build/icons/`
- macOS：hardenedRuntime、entitlements (`build/Entitlements.plist`)、icon (`build/icon.icns`)、dmg + zip、自动 notarize（需 `APPLE_ID`+`APPLE_APP_SPECIFIC_PASSWORD`+`APPLE_TEAM_ID`）
- Windows：nsis oneClick=false
- `CSC_IDENTITY_AUTO_DISCOVERY=false` + `CSC_LINK`（base64 .p12）走 p12 签名
- 注：v25 deprecate `notarize.teamId`，必须 env `APPLE_TEAM_ID`

**前置环境**
- Node 22+ / pnpm 10.26.2+ / Python 3.12+ / uv（CI 用 `astral-sh/setup-uv@v5`）

### D.5 关键环境变量

| 变量 | 用途 | 谁注入 |
| --- | --- | --- |
| `QILIN_HOME` | gateway state root | desktop backend.ts:287 |
| `QILIN_HOST_BASE_DIR` | per-thread data root | desktop backend.ts:290 |
| `QILIN_CONFIG_PATH` | config.yaml | desktop backend.ts:293 |
| `QILIN_EXTENSIONS_CONFIG_PATH` | extensions_config.json | desktop backend.ts:296 |
| `QILIN_SKILLS_PATH` | 技能根 | desktop backend.ts:298 |
| `QILIN_PROJECT_ROOT` | 仅 dev 注入 | desktop backend.ts:335 |
| `GATEWAY_CORS_ORIGINS` | CORS allowlist（desktop=app://-） | desktop backend.ts:300 |
| `CORS_ORIGINS` | 兼容名 | desktop backend.ts:301 |
| `AUTH_JWT_SECRET` | 持久化 JWT 签名密钥 | desktop backend.ts:306 |
| `GATEWAY_HOST` | 127.0.0.1 | desktop backend.ts:308 |
| `GATEWAY_PORT` | 19987 | desktop backend.ts:309 |
| `GATEWAY_LOG_LEVEL` | debug | desktop backend.ts:310 |
| `PLAYWRIGHT_BROWSERS_PATH` | 仅打包态设 | desktop backend.ts:322-329 |
| `KWORKS_SKIP_BACKEND_AUTOLAUNCH` | 跳过 backend 自动启 | desktop main.ts:79 |
| `KWORKS_GH_MIRROR` | GitHub release mirror | desktop updater.ts:91 |
| `KWORKS_DEV_SERVER` | dev mode loader | desktop main.ts:241 |
| `GATEWAY_PORT`（解析） | override 19987 | desktop backend.ts:79 |
| `GITHUB_WEBHOOK_SECRET` | github webhooks 路由挂载 | qilin/github_webhooks.py |
| `QILIN_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS` | dev opt-in | qilin/github_webhooks.py |

### D.6 IPC 重连 / 重启流程

- **desktop 自重启**：`BackendManager.restart()` → `stop()` → 1s sleep → `launch()`
- **gateway 重启后**：AUTH_JWT_SECRET 持久化保留；旧 JWT 仍有效；无需重新登录
- **frontend 重连**：renderer 启动调 `initGatewayPort()` 异步取端口；status 通过 IPC push
- **跨平台差异**：macOS `posix_spawnp` 需要 node-pty spawn-helper 有 `+x`（pnpm install 会丢权限，desktop/src/ipc.ts:119-168 自愈）

---

## E. 代码评审热点

### E.1 风险/复杂度聚焦

| 文件 | 行数 | 风险点 |
| --- | --- | --- |
| `qilin/app/gateway/services.py` | 1448 | run_config 拼装 + recursion_limit clamp + checkpoint state accessor 缓存；高频热点 |
| `qilin/qilin/runtime/runs/worker.py` | 2402 | run 主循环 + checkpoint lock + goal continuation；最复杂 |
| `qilin/qilin/runtime/runs/manager.py` | 2254 | 孤儿恢复 + lease + SQLite 重试；事务边界敏感 |
| `qilin/qilin/subagents/executor.py` | 1281 | isolated subagent loop + 终态 race；安全相关 |
| `qilin/qilin/agents/lead_agent/agent.py` | 974 | graph 装配 + 中间件顺序 + tracing 旗标不变量 |
| `qilin/qilin/agents/lead_agent/prompt.py` | 1131 | 大模板；分支多 |
| `qilin/app/gateway/app.py` | 694 | middleware 顺序 + lifespan 钩子编排 |
| `desktop/src/main.ts` | 701 | 全部 lifecycle；改动需回归 4 平台 |
| `desktop/src/backend.ts` | 884 | 子进程管理 + env 注入 + 跨平台 kill |
| `desktop/src/updater.ts` | 389 | electron-updater ASAR lazy getter 兼容 + gh mirror |

### E.2 安全相关热点

- **CSRF 漏洞面**：`csrf_middleware.py:238-256` 对 auth POST 同时做了 `is_allowed_auth_origin` + Bearer 跳过；`is_allowed_auth_origin` 同时拒绝路径非 HTTP/HTTPS 的 origin（`urlsplit` 失败返回 None → 拒绝）。注意：`_AUTH_EXEMPT_PATHS` 是白名单（login/local/logout/register/initialize），**不能漏 register 否则首次注册无法发起**
- **路径安全**：`frontend-protocol.ts:37-58` `normalizeSafeRelativePath` 拒 `..` 段；rsc 路径下也走同一检查
- **后端文件锁**：`qilin/qilin/sandbox/file_operation_lock.py:13-17` sandbox_id 优先 `id` 否则 `instance:{id(sandbox)}`—— WeakValueDictionary 自动清理防止长跑进程内存泄漏
- **subagent 限流**：`qilin/qilin/agents/middlewares/subagent_limit_middleware.py` 默认 `max_total_per_run=DEFAULT_MAX_TOTAL_SUBAGENTS_PER_RUN`；超限 emit `subagent_limit_truncated` 事件给前端
- **webhook fail-closed**：`github_webhooks.py is_route_enabled()` 仅当 `GITHUB_WEBHOOK_SECRET` 配置或 `QILIN_ALLOW_UNVERIFIED_GITHUB_WEBHOOKS=1` 才挂载（`app.py:665-669`）
- **shell env 注入**：`loadLoginShellEnv` 把登录 shell 全部变量注入 gateway env（backend.ts:722-775）；**macOS GUI app 不 source rc 是已知问题**，但任意 rc 脚本的 export 都会进 gateway 子进程；任何 `set -e; prompt-question` 类阻塞会卡 10s 超时
- **Bearer 跳过 CSRF**：桌面 `app://` cross-scheme 不能读 cookie，故 renderer 必须从 localStorage 取 token 后 `Authorization: Bearer ...`；`api-client.ts:60-82` 的 `injectDesktopAuthorization` 注释明确 dev mode 也走 Bearer（同站点跨端口 cookie 不可靠）

### E.3 性能热点

- **graph 缓存 8 上限**：`orchestration_cache.py:81-83` `_entries.clear()` 而非 LRU；高并发 + 频繁切 user/model 时可能抖动；建议升级 LRU
- **SQLite busy_timeout**：env.py:88-104 alembic + engine 都设 30s；多进程并发写需要这个兜底
- **memory flush**：`shutdown_flush_timeout_seconds` 必须 < K8s `terminationGracePeriodSeconds`；`memory.shutdown_flush_timeout_seconds` 可在 config 配置
- **macOS power save blocker**：必须保留，否则后台 SSE 长任务被 App Nap 节流断流
- **playwright Chromium COLLECT 坑**：spec 注释解释了为何不能在 datas 里——已经解决

### E.4 兼容性热点

- **Electron preload 必须 `.cjs`**（main.ts:170-174 注释）—— sandbox loader 不支持 ESM `import`
- **electron-updater ASAR lazy getter**（updater.ts:189-200）：3 策略解析 `autoUpdater`，其中 require 路径才能保留 lazy getter
- **Next 16 RSC 静态导出**：`frontend-protocol.ts:82-83` `CHATS_DYNAMIC_RSC` 静态映射 `workspace/chats/new/__next.workspace.chats.$d$thread_id.__PAGE__.txt`；动态路由只有 placeholder，需 fallback HTML
- **macOS App Nap + SSE**：`main.ts:166-169` `backgroundThrottling: false`；`main.ts:604-610` powerSaveBlocker
- **PyInstaller 与 PyPI mcp 冲突**：`kworks-gateway.spec` 注释解释了为何不整体复制 `_internal/qilin/`——避免 `qilin.mcp` 与顶层 `mcp` SDK 循环导入
- **Node 22+ ABI 130**：node-pty 1.1.0 prebuild 已对齐；`npmRebuild: false` 避免 Python ≥3.12 distutils 缺失

### E.5 一致性热点（多处镜像同一份协议）

- `desktop/src/preload.ts:14-82` 类型 + `frontend/src/core/desktop/types.ts` —— **手工同步**，无 codegen
- `desktop/src/skill-models-env.ts:42-109` `SKILL_MODEL_PROVIDERS` + frontend `core/skill-models/types.ts` —— 同样手工
- SSE 事件类型：`qilin/qilin/tools/builtins/task_tool.py` 与 `qilin/qilin/agents/middlewares/llm_error_handling_middleware.py` 与 `frontend/src/core/threads/stream-event-handler.ts` + `run-events-api.ts` —— 至少 4 处
- RunEventDefinition：`qilin/qilin/runtime/events/catalog.py` 校验 producer 与 backend 测试对齐
- SubagentExecutor 12 函数命名 vs frontend 7 类事件映射 —— 存在 `task_tool.py` "task_started/running/completed/failed/cancelled/timed_out" 6 类，但前端只匹配其中 5 类（差 `task_started` 由 task_running 隐含）

### E.6 文档/测试一致性

- `CHANGELOG.md` 由 release.sh 自动生成（基于 git log subject）；developer 提交规范未文档化
- `README.md` / `README.zh.md` 与 `release.sh` usage 信息不一致（README 是否提到 `--full-tests` 待核对）

---

## F. 关键文件清单（按调研权重排序）

### F.1 desktop（Electron 主进程）

| 文件 | 行数 | 调研价值 |
| --- | --- | --- |
| `desktop/src/backend.ts` | 884 | ⭐⭐⭐ 子进程管理、env 注入、跨平台 kill、迁移、initSkills |
| `desktop/src/main.ts` | 701 | ⭐⭐⭐ lifecycle、tray、menu、IPC 注册、protocol.handle(RSC) |
| `desktop/src/ipc.ts` | 449 | ⭐⭐ IPC handler 注册 + terminal session |
| `desktop/src/paths.ts` | 251 | ⭐⭐ 路径解析 desktop/packaged 双模式 |
| `desktop/src/preload.ts` | 222 | ⭐⭐ contextBridge + 类型镜像 |
| `desktop/src/updater.ts` | 389 | ⭐⭐ electron-updater 兼容 + gh mirror |
| `desktop/src/config-migration.ts` | 240 | ⭐ config 三段迁移（含 byte-exact 浏览器工具块替换） |
| `desktop/src/skill-models-env.ts` | 310 | ⭐ 凭证读写 + redaction + 5 个 provider 定义 |
| `desktop/src/frontend-protocol.ts` | 192 | ⭐⭐ RSC 静态导出路径解析（dynamic route → placeholder） |
| `desktop/src/url-policy.ts` | 25 | 简单 URL 白名单 |
| `desktop/src/shutdown.ts` | 23 | Promise.race timeout |
| `desktop/src/logger.ts` | 83 | 三日志流（truncate per launch） |
| `desktop/electron-builder.yml` | 100+ | 打包配置 + 签名 + notarize |
| `desktop/backend-build/kworks-gateway.spec` | 100+ | PyInstaller datas/blacklist |
| `desktop/scripts/build-gateway.sh` | 130+ | 打包脚本（playwright post-copy） |
| `desktop/tests/*.test.mjs` | 16 个 | 集成测试 |

### F.2 qilin（Python engine）

| 文件 | 行数 | 调研价值 |
| --- | --- | --- |
| `qilin/qilin/client.py` | 1687 | ⭐⭐ 嵌入式 SDK；StreamEvent/StreamEventType literal |
| `qilin/qilin/agents/factory.py` | 464 | ⭐⭐⭐ create_qilin_agent + 14 middleware 装配 + features 三选项 |
| `qilin/qilin/agents/lead_agent/agent.py` | 974 | ⭐⭐⭐ _make_lead_agent + fingerprint cache + tracing invariant |
| `qilin/qilin/agents/lead_agent/orchestration_cache.py` | 93 | ⭐⭐ FingerprintedGraphCache（clear-not-LRU） |
| `qilin/qilin/agents/lead_agent/prompt.py` | 1131 | ⭐ 大模板 |
| `qilin/qilin/orchestration/graph.py` | 161 | ⭐⭐⭐ orchestrator + N worker FIFO；失败隔离 |
| `qilin/qilin/orchestration/handoff.py` | 63 | ⭐⭐ AgentHandoff + inherit_trace_id |
| `qilin/qilin/orchestration/inbox.py` | 152 | ⭐⭐ asyncio.Queue + 订阅者 |
| `qilin/qilin/orchestration/patterns.py` | 92 | ⭐⭐ orchestrator_workers + peer_consensus |
| `qilin/qilin/subagents/executor.py` | 1281 | ⭐⭐⭐ SubagentStatus race + isolated loop + 12 公开函数 |
| `qilin/qilin/subagents/batch.py` | 82 | ⭐⭐ run_batch_async + Semaphore |
| `qilin/qilin/runtime/runs/manager.py` | 2254 | ⭐⭐⭐ 孤儿恢复 + lease + SQLite 重试 |
| `qilin/qilin/runtime/runs/worker.py` | 2402 | ⭐⭐⭐ run 主循环 + checkpoint lock + goal continuation |
| `qilin/qilin/sandbox/file_operation_lock.py` | 27 | ⭐ WeakValueDictionary 防内存泄漏 |
| `qilin/qilin/runtime/events/catalog.py` | - | ⭐ RunEventDefinition 校验 |
| `qilin/qilin/runtime/goal.py` | - | ⭐ GoalState + continuation |
| `qilin/qilin/persistence/migrations/versions/` | 10 文件 | ⭐ Alembic 历史 |

### F.3 qilin/app/gateway

| 文件 | 行数 | 调研价值 |
| --- | --- | --- |
| `qilin/app/gateway/app.py` | 694 | ⭐⭐⭐ middleware 顺序 + lifespan 编排 + router 挂载 |
| `qilin/app/gateway/csrf_middleware.py` | 306 | ⭐⭐⭐ Double Submit Cookie + Bearer 跳过 |
| `qilin/app/gateway/services.py` | 1448 | ⭐⭐⭐ run 入口 + accessor cache + start_run/launch_scheduled |
| `qilin/app/gateway/routers/*.py` | 21 文件 | ⭐⭐ 各自 prefix/endpoints 见 §C.3 |
| `qilin/app/gateway/auth/*` | - | ⭐ OIDC + JWT + session cookie |
| `qilin/app/gateway/auth_middleware.py` | - | ⭐ fail-closed + 公共路径白名单 |
| `qilin/app/gateway/deps.py` | - | ⭐ langgraph_runtime async ctx + get_stream_bridge |

### F.4 frontend（Next.js）

| 区域 | 调研价值 |
| --- | --- |
| `frontend/src/core/api/api-client.ts` | ⭐⭐ injectCsrfHeader + injectDesktopAuthorization |
| `frontend/src/core/threads/stream-event-handler.ts` (212) | ⭐⭐ 7 类事件分发 |
| `frontend/src/core/threads/run-events-api.ts` | ⭐ SubagentStepEvent 数据契约 |
| `frontend/src/core/threads/types.ts` | ⭐ AgentThreadState / AgentThreadContext 镜像 |
| `frontend/src/core/api/fetcher.ts` | ⭐⭐ STATE_CHANGING_METHODS + readCsrfCookie |
| `frontend/src/core/api/stream-mode.ts` | ⭐ sanitizeRunStreamOptions |
| `frontend/src/core/desktop/*` | ⭐ 类型镜像 desktop/src/preload.ts |
| `frontend/src/core/skills/templates.ts` | ⚠ 11 TODO 残留 |
| `frontend/playwright.config.ts` | ⭐ baseURL=9192 / CI 命令 `pnpm build && pnpm start` |

### F.5 部署/构建

| 文件 | 调研价值 |
| --- | --- |
| `release.sh` (782) | ⭐⭐⭐ 全流程 |
| `.github/workflows/release-desktop.yml` | ⭐⭐ 三平台矩阵 |
| `desktop/electron-builder.yml` | ⭐ 签名 + notarize |
| `desktop/backend-build/kworks-gateway.spec` | ⭐ PyInstaller datas |
| `desktop/scripts/build-gateway.sh` | ⭐ playwright post-copy |
| `qilin/pyproject.toml` | ⭐ extras：gateway / channels / redis / postgres / pymupdf / boxlite / tui / groundroute / ollama |
| `qilin/config.example.yaml` (config_version 32) | ⭐ 配置 schema 模板 |

---

## G. 待用户决策问题（≤5 条）

1. **graph cache 策略升级**：当前 `FingerprintedGraphCache` 超 8 条 `_entries.clear()`（非 LRU）；如要承接多 user 多 model 的高并发（如 A/B 测试、租户多 agent），是否升级为 LRU/FIFO 驱逐？

2. **subagent executor 单测**：当前 `qilin/qilin/subagents/executor.py` 1281 行无独立测试，仅 batch 有覆盖；是否进入 v1.0.8 计划？重点测试 `_extract_final_result` fallback 路径（hit-recursion_limit 后的部分恢复，#3875 Phase 2）、`try_set_terminal` race、isolated loop shutdown。

3. **CSRF Bearer 跳过策略**：桌面端 Bearer 跳过 CSRF 是当前架构基础（`app://` cross-scheme 无法用 cookie）；如未来要支持桌面端使用 cookie 鉴权（减小 localStorage XSS 面），是否要扩展 dev/prod 模式分支？

4. **loadLoginShellEnv 注入面**：当前 macOS 登录 shell 所有 export 变量（`TUSHARE_TOKEN`、`ZHIPU_API_KEY`、自定义 `PATH` 等）都进 gateway 子进程；如果用户的 rc 脚本含交互命令（`powerlevel10k` 等），10s timeout 内可能错过；是否要做白名单/可关闭？

5. **frontend events 协议扩展**：当前后端发 `task_started/running/completed/failed/cancelled/timed_out`（6 类）+ `subagent_limit_truncated` + `llm_retry`（共 8 类），前端 `stream-event-handler.ts` 只识别 7 类（缺 `task_started` 被 `task_running` 隐含）。是否在 v1.0.8 引入事件协议 codegen 或 schema（避免再次出现 backend/frontend drift）？

---

> 报告生成完毕。F/G 节可直接作为后续工作输入。
> 子代理在调研期间未执行任何修改/构建/测试/git push/install 操作；所有路径与代码片段来自只读 `read`/`bash` `ls`/`grep`/`find` 调用。