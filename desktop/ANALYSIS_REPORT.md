# KWorks desktop 模块全面分析报告

> 范围: `/Users/libing/kk_Projects/KWorks/desktop/`
> 报告产物: Electron 桌面外壳 (TypeScript) + 内置 Python Gateway (PyInstaller onedir)
> 版本: `package.json` 中 `version: 1.0.7`, release 产物已发布到 `KWorks-1.0.0-arm64-mac.zip` / `KWorks-1.0.0-arm64.dmg` / `latest-mac.yml`
> 所有代码、路径、标识符、日志原文保持原样;说明文字一律使用简体中文。

---

## 1. 技术栈

| 维度 | 选型 | 关键事实 |
| --- | --- | --- |
| 桌面运行时 | **Electron 33.2.0** (`package.json:33`) | 主进程与 preload 通过 `contextBridge` 隔离 |
| 语言 | **TypeScript 5.8.2** (`package.json:35`) | 两份 `tsconfig.json` 区分主进程 (ESM) 与 preload (CJS) |
| 主进程模块系统 | **ESM** (`"type": "module"`, `tsconfig.json:7` `module: ESNext`) | `main.ts` 以 `import.meta.url` 自推导 `__dirname` (`src/main.ts:29`) |
| Preload 模块系统 | **CommonJS** (`tsconfig.preload.json:5` `module: CommonJS`) | 构建脚本最后一步 `mv -f dist/preload.js dist/preload.cjs` (`package.json:13`) — 因为 Electron sandbox loader 不支持 ESM |
| 构建工具 | **裸 TypeScript** (`tsc`) + `electron-builder 25.1.8` | 无 Vite / Webpack / esbuild |
| 类型 | `@types/node: ^20.14.10` (`package.json:34`),`tsconfig.json` 启用 `strict: true` |
| 运行时依赖 | `electron-updater@^6.3.9`、`node-pty@^1.1.0` (`package.json:29-32`) | 全部为 native 模块,`pnpm.onlyBuiltDependencies` 仅允许这两个 |
| 包管理 | pnpm | 通过 `pnpm.overrides` + `postinstall` (`fix-node-pty-permissions.mjs`) 修复 `posix_spawnp` 问题 |
| 内置后端 | **Python Gateway (PyInstaller onedir)** (`resources/gateway/kworks-gateway`, 49.5 MB) | 入口 `scripts/run_gateway.py`,通过 uvicorn 启动 FastAPI app |
| 前端产物 | **Next.js 静态导出** (`frontend/out`,作为 `extraResources` 的 `frontend-out/`) | `package.json:18` `build:frontend` 调 `pnpm --dir ../frontend run build:desktop` |

---

## 2. 进程模型与子进程管理

### 2.1 进程边界

```
┌────────────────────────────────────────────────────────────────────────┐
│  Electron 主进程 (main.ts, ESM)                                         │
│  ├─ BrowserWindow 集合 appWindows + lastActiveWindow (src/main.ts:61-64)│
│  ├─ Tray (src/main.ts:526)                                              │
│  ├─ Native Menu (src/main.ts:488)                                       │
│  ├─ BackendManager (src/backend.ts, EventEmitter)                       │
│  │   └─ child_process.spawn → Python gateway (PyInstaller exe)          │
│  │       └─ uvicorn → FastAPI app (app.gateway.app:app)                 │
│  ├─ powerSaveBlocker("prevent-app-suspension") (src/main.ts:608)        │
│  └─ ipcMain handlers (src/ipc.ts:286)                                   │
├────────────────────────────────────────────────────────────────────────┤
│  Preload (preload.ts → dist/preload.cjs, CommonJS)                      │
│  └─ contextBridge.exposeInMainWorld("kworksDesktop", { ... })           │
│      (src/preload.ts:90)                                                 │
├────────────────────────────────────────────────────────────────────────┤
│  渲染进程 (Next.js 静态导出 + Electron 33)                                │
│  ├─ contextIsolation: true, nodeIntegration: false, sandbox: true        │
│  ├─ 加载 URL: dev = http://127.0.0.1:18569,prod = app://- (主协议)      │
│  └─ 通过 window.kworksDesktop.* 调 IPC                                  │
├────────────────────────────────────────────────────────────────────────┤
│  Dev launcher (scripts/dev.mjs) — 仅开发时存在,生产不会启动               │
│  ├─ uv run uvicorn (qilin 子模块)                                        │
│  ├─ next dev --hostname 127.0.0.1 --port 18569                          │
│  └─ electron . (设 KWORKS_DEV_SERVER=1)                                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 单实例锁与多窗口

- `app.requestSingleInstanceLock()` (`src/main.ts:73`),后续实例触发 `second-instance` 事件时复用 `showLastActiveWindow()` (`src/main.ts:641`)
- `appWindows: Set<BrowserWindow>` (`src/main.ts:61`),通过 `createAppWindow()` 与 `createNewTaskWindow("/workspace/chats/new")` (`src/main.ts:277`) 支持多聊天窗口
- macOS dock 激活: `app.on("activate")` (`src/main.ts:653`) — 无窗口则创建,有则显示最近

### 2.3 Python Gateway 生命周期 (BackendManager)

状态机: `stopped → starting → running | error → stopped` (`src/backend.ts:90`)

启动序列 (`src/backend.ts:126` `Backend.launch`):
1. `migrateLegacyUserData()` — 从 `~/.oclaw` 或 `<userData>/.kkoclaw` 迁移(`src/backend.ts:533`)
2. `ensureDataDirs()` — `~/.kworks/{logs,data,threads,agents}` (`src/backend.ts:603`)
3. `initConfig()` — 从 `backend-build/config.embedded.yaml` 拷贝到 `~/.kworks/config.yaml` (`src/backend.ts:612`)
4. `migrateConfig()` — `migrateDesktopConfigYaml()` 注入 sqlite_dir / agents_api / 原生浏览器工具 (`src/backend.ts:632`)
5. `initExtensionsConfig()` — 写空 `{mcpServers:{}, skills:{}}` 到 `~/.kworks/extensions_config.json` (`src/backend.ts:650`)
6. `initSkillModelsEnv()` — 首次启动建空 `.env` (`src/backend.ts:675`)
7. `initSkills()` — 从打包的 `resources/gateway/_internal/skills/builtin/{core,task}` 拷贝到 `~/.kworks/skills/public/` (`src/backend.ts:826`),`custom/` 始终保留为空可写
8. `openLogStream()` — `flags: "w"` 截断 `~/.kworks/logs/gateway.log` (`src/backend.ts:374`)
9. `resolveCommand()` — 三级 fallback (`src/backend.ts:216`):
   1. `resources/gateway/kworks-gateway[.exe]` (PyInstaller bundle)
   2. `uv run python -m uvicorn app.gateway.app:app --host 127.0.0.1 --port <port>` (走 `qilin/` git submodule)
   3. 返回 `null` → 状态置 `error`
10. `spawn()` 注入 `buildEnv()` 的环境变量 (`src/backend.ts:270`)
11. `wireProcessIO()` — 按行缓冲 stdout/stderr (`src/backend.ts:343`)
12. `startHealthMonitor()` — 500 ms 间隔 `fetch http://127.0.0.1:19987/health`,120 s timeout (`src/backend.ts:401`)
13. 健康通过 → 状态置 `running`,后续 `onStatusChange` 推 tray 菜单 (`src/main.ts:620`)

停止流程:
- 平台分支 (`src/backend.ts:459`):
  - win32: `taskkill /pid /f /t`,2 s 内未退 → 强制 kill
  - POSIX: SIGTERM → 500 ms 后 SIGKILL
- `stopBackendWithTimeout(backend, ms)` (`src/shutdown.ts:5`) 提供带超时的 `Promise.race` 包装,`main.ts:692` 在 `before-quit` 中以 3 s 超时触发

环境变量关键集合 (`src/backend.ts:270` `buildEnv`):
- `QILIN_HOME` / `QILIN_HOST_BASE_DIR` = `~/.kworks`
- `QILIN_CONFIG_PATH` = `~/.kworks/config.yaml`
- `QILIN_EXTENSIONS_CONFIG_PATH` = `~/.kworks/extensions_config.json`
- `QILIN_SKILLS_PATH` = `~/.kworks/skills`
- `QILIN_PROJECT_ROOT` 仅 dev 设置,避免 PyInstaller bundle 误读 (`src/backend.ts:334`)
- `GATEWAY_CORS_ORIGINS` = `"app://-"` (匹配 `app://-` 协议 origin)
- `AUTH_JWT_SECRET` = `ensureAuthJwtSecret()` 持久化到 `~/.kworks/.auth_jwt_secret` (`src/backend.ts:785`),32 字节 randomBytes base64url,避免重启后所有 token 失效
- `PLAYWRIGHT_BROWSERS_PATH` 指向 `resources/gateway/_internal/ms-playwright` (仅 packaged) (`src/backend.ts:322`)
- `loadLoginShellEnv()` (`src/backend.ts:722`) 通过 `shell -l -i -c 'env'` 继承 macOS launchd 启动 GUI 时丢失的 `~/.zshrc` 凭证(TUSHARE_TOKEN / ZHIPU_API_KEY 等),过滤 `[A-Za-z_][A-Za-z0-9_]*` 命名

### 2.4 Dev launcher (`scripts/dev.mjs`)

- 与生产路径互斥:`KWORKS_SKIP_BACKEND_AUTOLAUNCH=1` 标记 dev 模式,`main.ts:79` 通过 `isBackendAutolaunchEnabled()` 跳过 `backend.launch()`,但仍注册 IPC handler 以便 dev 也能通过 IPC 重启 dev launcher 托管的 gateway
- CORS 注入:`DESKTOP_DEV_ORIGINS = "app://-,http://127.0.0.1:18569,http://localhost:18569"` 让 Next.js dev server 也被 gateway 信任
- 把每个子进程 `detached: true` (`scripts/dev.mjs`) 进入独立进程组,Ctrl-C 用负 PID 杀整组,避免 `uv run` 孙子进程残留占用 19987
- 把 launcher 自身的意外退出写到 `~/.kworks/logs/dev-exits.log`,便于事后区分 SIGTERM vs SIGHUP

---

## 3. IPC 设计

### 3.1 通道清单 (源码)

下表按 `src/ipc.ts:286` 注册顺序、`src/preload.ts:90` 暴露顺序列出所有通道;事件(主→渲染)放在最右侧 `src/preload.ts` 的 `on*(...)` 函数返回 unsubscribe。

| 命名空间 | 通道 | 方向 | 注册位置 (`src/ipc.ts`) | preload 暴露 (`src/preload.ts`) | 敏感点 / 安全设计 |
| --- | --- | --- | --- | --- | --- |
| backend | `backend:get-gateway-config` | invoke | `src/ipc.ts:303` | `getGatewayConfig` (`preload.ts:94`) | 返回 `{port: resolveGatewayPort()}` |
| backend | `backend:get-status` | invoke | `src/ipc.ts:290` | `getBackendStatus` (`preload.ts:96`) | 快照,无副作用 |
| backend | `backend:start` | invoke | `src/ipc.ts:293` | `startBackend` (`preload.ts:98`) | 内部去重:已在跑则直接返回 |
| backend | `backend:stop` | invoke | `src/ipc.ts:296` | `stopBackend` (`preload.ts:100`) | |
| backend | `backend:restart` | invoke | `src/ipc.ts:299` | `restartBackend` (`preload.ts:102`) | `stop` → 1 s 间隔 → `launch` |
| backend | `backend:get-logs` | invoke | `src/ipc.ts:302` | `getBackendLogs` (`preload.ts:104`) | 最多 500 行环形缓冲 |
| dialog | `dialog:pick-files` | invoke | `src/ipc.ts:308` | `pickFiles` (`preload.ts:108`) | `BrowserWindow.fromWebContents(_evt.sender)` 拿到调用方窗口,挂到 `dialog.showOpenDialog(win, ...)`,读文件 → `Uint8Array` |
| dialog | `dialog:pick-directory` | invoke | `src/ipc.ts:390` | `pickDirectory` (`preload.ts:110`) | 同上,只返回路径不读内容 |
| shell | `shell:open-external` | invoke | `src/ipc.ts:339` | `openExternal` (`preload.ts:114`) | **敏感**: `isAllowedExternalUrl()` 仅允许 `http:` / `https:`,其余 `throw new Error("Blocked external URL.")` |
| shell | `shell:open-folder` | invoke | `src/ipc.ts:347` | `openFolder` (`preload.ts:116`) | `shell.openPath(folderPath)` 直接交给系统 |
| terminal | `terminal:start` | invoke | `src/ipc.ts:352` | `startTerminal` (`preload.ts:118`) | **越权防护**: terminal 进程记录 `owner = _evt.sender`;后续 write/resize/stop 必须同 owner |
| terminal | `terminal:write` | invoke | `src/ipc.ts:358` | `writeTerminal` (`preload.ts:120`) | 同上,`terminal.owner !== _evt.sender` 直接抛错 |
| terminal | `terminal:resize` | invoke | `src/ipc.ts:368` | `resizeTerminal` (`preload.ts:122`) | 同上 |
| terminal | `terminal:stop` | invoke | `src/ipc.ts:383` | `stopTerminal` (`preload.ts:128`) | 同上 |
| terminal | `terminal:data` | **send** (主→渲) | `ipc.ts:251` `owner.send("terminal:data", {sessionId, data})` | `onTerminalData` (`preload.ts:130`) | 返回 unsubscribe |
| terminal | `terminal:exit` | **send** (主→渲) | `ipc.ts:261` | `onTerminalExit` (`preload.ts:144`) | 同上 |
| desktop | `desktop:file-drop` | **send** (主→渲) | `src/ipc.ts:447` (在 `forwardFileDrop`) | `onFileDrop` (`preload.ts:158`) | 主进程读取 OS drop 路径后推送 |
| updater | `updater:check` | invoke | `src/updater.ts:325` | `checkForUpdates` (`preload.ts:172`) | 失败返回 `{available: false}`,不抛 |
| updater | `updater:install` | invoke | `src/updater.ts:361` | `installUpdate` (`preload.ts:174`) | 设置 `isUpdateInstallInProgress = true` → `quitAndInstall()` |
| menu | `menu:check-update` | **send** (主→渲) | `src/main.ts:466` (帮助菜单点"检查更新…") | `onCheckUpdateRequest` (`preload.ts:176`) | |
| updater | `updater:downloading` | **send** (主→渲) | `src/updater.ts:287` (`notifyAllWindows`) | `onUpdateDownloading` (`preload.ts:190`) | `autoDownload=true`,静默推送 |
| updater | `updater:ready` | **send** (主→渲) | `src/updater.ts:309` | `onUpdateReady` (`preload.ts:202`) | 下载完成,触发"立即重启安装"提示 |
| skill-models | `skill-models:get` | invoke | `src/ipc.ts:410` | `getSkillModels` (`preload.ts:216`) | 返回 `redactValue` 后的快照,secret 显示 `***` + last 4 字符 |
| skill-models | `skill-models:set` | invoke | `src/ipc.ts:418` | `setSkillModels` (`preload.ts:218`) | secret 字段若收到 `***-` 前缀占位符,保留原值;空串显式清空 |

### 3.2 preload ↔ frontend 桥契约

- `preload.ts:90` `contextBridge.exposeInMainWorld("kworksDesktop", { gatewayPort: 19987, ... })`
- 类型镜像声明在 `src/preload.ts` 顶部,与 `frontend/src/core/desktop/types.ts` 一一对应;`DESIGNENT_KEYS` 命名风格沿用 Tauri 时期(`shell:open-external`、`terminal:start` 等)

### 3.3 协议层 (app://)

- 启动时 `protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard, secure, supportFetchAPI, corsEnabled } }])` (`src/main.ts:49`) — 必须早于 `app.whenReady`
- `protocol.handle("app", ...)` (`src/main.ts:322` `registerFrontendProtocol`) 根据 `request.headers.get("rsc") === "1"` 区分:
  - **普通页面**: 走 `frontend-protocol.ts:resolveFrontendRequestPath` 解析(`src/frontend-protocol.ts:85`),13 种扩展名 MIME 映射 (`src/main.ts:292` `MIME_BY_EXTENSION`);文件不存在 → 退回 `index.html`
  - **RSC payload** (`RSC: 1`): 重映射 Next.js App Router 的 `__next.<segments>.__PAGE__.txt` (`src/frontend-protocol.ts:134`),动态段 `/workspace/chats/<id>` 全部复用 `workspace/chats/new/__next.workspace.chats.$d$thread_id.__PAGE__.txt` (单一 placeholder 即可,因为 `[thread_id]` 是客户端组件)
- `frontend-protocol.ts:37 normalizeSafeRelativePath` 拒绝 `..` 段、含 `\0` 的解码路径,`normalize()` 后若以 `..` 或 `/` 开头仍判定非法 — 这是 path traversal 的最后一道闸

### 3.4 自定义协议 fallback

- `setWindowOpenHandler` (`src/main.ts:216`): 仅 `isAllowedExternalUrl(url)` 通过时 `shell.openExternal`,否则 `{ action: "deny" }`
- `will-navigate` (`src/main.ts:225`): 阻断 `file://` drop 与非白名单 origin,白名单 (`url-policy.ts:13 isAllowedAppNavigationUrl`) 仅允许 `app://-` 与 dev 的 `http://127.0.0.1:18569`

---

## 4. 窗口管理

| 项目 | 行为 |
| --- | --- |
| 初始窗口 | `1200x800`,`minWidth: 800, minHeight: 600`,`center: true`,`show: false`,`backgroundColor: "#0a0a0a"` (`src/main.ts:140`) |
| 首次显示 | `ready-to-show` 后 `win.maximize(); win.show()` (`src/main.ts:210`) |
| macOS chrome | `titleBarStyle: "hiddenInset"` (`src/main.ts:158`),与 `nativeTheme.themeSource = "dark"` (`src/main.ts:68`) 配合,traffic-light 按钮内嵌 |
| Windows/Linux | 默认 frame |
| 关闭语义 | `close` 事件非 quit 状态时 `e.preventDefault(); win.hide()` — 最小化到 tray (`src/main.ts:191`) |
| tray 触发 | 点击 `showLastActiveWindow()` (`src/main.ts:533`) |
| 全局快捷键 | `Cmd/Ctrl+Shift+O` toggle 可见 (`src/main.ts:555`) |
| 多窗口 | `createAppWindow({ path })` (`src/main.ts:139`) 支持任意 path;菜单"窗口 → 新建聊天窗口" `Cmd/Ctrl+Shift+N` (`src/main.ts:443`);`Cmd/Ctrl+Shift+H` 跳到 `/workspace/chats/new`,`Cmd/Ctrl+Shift+A` 跳到 `/workspace/agents` (`src/main.ts:399`) |
| 启动模式菜单 | macOS 完整 App menu,Windows/Linux 文件菜单只放"退出" (`src/main.ts:388`) |
| 卸载全局快捷键 | `will-quit` 触发 `globalShortcut.unregisterAll()` (`src/main.ts:699`) |
| 退出 quit 流程 | `isQuitting = true` 后 `app.quit()` (`src/main.ts:589`),走完整生命周期确保 Squirrel.Mac 能完成 update (`src/main.ts:583` 注释) |

---

## 5. 安全策略现状

### 5.1 webPreferences (`src/main.ts:160-174`)

| 选项 | 值 | 说明 |
| --- | --- | --- |
| `contextIsolation` | `true` | 渲染进程只看到 `window.kworksDesktop`,无 Node |
| `nodeIntegration` | `false` | 关闭 renderer 内 `require` |
| `sandbox` | `true` | 强制 Chromium OS-level sandbox |
| `backgroundThrottling` | `false` | 防 App Nap / Chromium throttle 切断 SSE |
| `preload` | `dist/preload.cjs` | CommonJS,sandbox loader 兼容 |
| `webSecurity` | **未显式设置** | Electron 33 默认 `true`,功能上是开启的 |

### 5.2 安全边界

- ✅ **URL 白名单**(`src/url-policy.ts:25`): 内部仅允许 `app://-` + dev `http://127.0.0.1:18569`;外部仅允许 `http(s)://`
- ✅ **Path traversal 拦截**(`src/frontend-protocol.ts:37`): 解码 + normalize + 多重 `..` 检查
- ✅ **Terminal 越权防护**(`src/ipc.ts:362` 等): 每次操作必须 `terminal.owner === _evt.sender`,destroyed 的 owner 也会被清理
- ✅ **对话框归属**(`src/ipc.ts:311`): `BrowserWindow.fromWebContents(_evt.sender)` 而非全局主窗口
- ✅ **JWT secret 持久化**(`src/backend.ts:785`): 重启不会让所有 token 失效
- ✅ **API key 不进 IPC 返回**(`src/skill-models-env.ts:219 redactValue`): secret 始终 `***` + last 4 字符
- ✅ **可执行文件权限自愈**(`scripts/fix-node-pty-permissions.mjs` + `src/ipc.ts:119 ensureNodePtySpawnHelperExecutable`): postinstall + 运行时双重修复,杜绝 `posix_spawnp failed.`
- ✅ **Electron 自动更新源过滤**(`src/updater.ts:90 setupGitHubReleaseMirror`): 仅重写 `https://github.com/*/*/releases/download/*`,其他请求不动;通过 `KWORKS_GH_MIRROR=空` 可整体禁用
- ✅ **Mac hardened runtime + entitlements**(`build/Entitlements.plist`): allow-jit / allow-unsigned-executable-memory / allow-dyld-environment-variables / disable-library-validation / debugger / inherit — 这是 Electron + node-pty + PyInstaller gateway 三者所必需(`build/Entitlements.plist:5` 注释)
- ✅ **窗口/协议按特权注册**(`src/main.ts:49`): `app` scheme 走 `standard/secure/supportFetchAPI/corsEnabled`
- ✅ **不会复用外部 gateway**(`tests/no-reuse-web-service.test.mjs`): 强制每次自管子进程,不检查端口已占用就复用
- ⚠️ **`loadLoginShellEnv()`**(`src/backend.ts:722`) 会把用户 shell 的所有 `KEY=VALUE` 注入 gateway 环境。这是有意为之(解决 launchd 不 source rc),但意味着 `~/.zshrc` 中 export 的任何变量(包括错误 export 的、或被父 shell 传下的 `LD_*`、`DYLD_*` 等)都进了 gateway;`PYTHONUNBUFFERED`、`PYTHONDONTWRITEBYTECODE` 会被覆盖因为它们在 `buildEnv` 里后写
- ⚠️ **`dev.mjs` detached 进程组**: 用 `process.kill(-pid, 'SIGTERM')` 杀整组,会一并杀掉同进程组下的孙进程 — 在 terminal 多任务并行的开发环境里要小心误杀
- ⚠️ **`shell:open-folder`** 没有验证 `folderPath`,任何 renderer 都能让 `shell.openPath` 打开任意路径(包括 macOS 上 `open /`)— 风险取决于前端可信度,但作为最小权限原则仍建议加入白名单或限沙箱目录
- ⚠️ **Updater 走 github mirror**: 大陆通过 `gh-proxy.com` 加速,但镜像运营方可见 release artifact 流量(只代理下载,不动元数据);`KWORKS_GH_MIRROR=` 可关

### 5.3 已知修复注释

| 问题 | 处理 | 位置 |
| --- | --- | --- |
| `posix_spawnp failed.` (pnpm 丢失 +x) | postinstall + 运行时 chmod 双重 | `scripts/fix-node-pty-permissions.mjs` + `src/ipc.ts:119` |
| `Cannot set properties of undefined (setting 'autoDownload')` (ASAR 中 ESM 互操作丢失 lazy getter) | `resolveAutoUpdater()` 三级策略:require → dynamic import → 手动 new NsisUpdater/MacUpdater/AppImageUpdater | `src/updater.ts:189` |
| `Failed to fetch RSC payload` (动态路由 fallback HTML 引发整页刷新,杀掉 SSE) | `protocol.handle` 识别 `RSC: 1` 头,把 `<id>` 全部映射到 placeholder | `src/main.ts:331` + `src/frontend-protocol.ts:120` |
| macOS launchd 不 source rc,导致 user credential 不可见 | `loadLoginShellEnv()` 通过 `shell -l -i -c 'env'` 继承 | `src/backend.ts:722` |
| AUTH_JWT_SECRET 每次重启都新生成,所有 token 失效 | `~/.kworks/.auth_jwt_secret` 持久化 | `src/backend.ts:785` |

---

## 6. 打包发布

### 6.1 electron-builder 配置要点 (`electron-builder.yml:124`)

| 字段 | 值 |
| --- | --- |
| `appId` | `com.kworks.desktop` |
| `productName` | `KWorks` |
| `directories.output` | `release/` |
| `directories.buildResources` | `build/` |
| `npmRebuild` | `false` (注释解释 node-pty 1.1.0 prebuild 兼容 Electron 33) |
| `files` | `dist/**/*`, `package.json`;排除 `*.map`、`*.ts` |
| `extraResources` | `resources/gateway → gateway`, `../frontend/out → frontend-out`, `build/tray-icons → tray-icons (16/32/64)`, `build/icons → icons (16/32)` |

macOS (`electron-builder.yml:46-91`):
- target: `dmg`, `zip`
- `hardenedRuntime: true`, `gatekeeperAssess: false`
- `entitlements` / `entitlementsInherit` 都指向 `build/Entitlements.plist`
- `icon: build/icon.icns`
- `extendInfo: { CFBundleDisplayName: "KWorks", CFBundleName: "KWorks" }` — 防 title bar 显示成错拼名
- DMG: title = `${productName} ${version}`,布局 130×220 / 410×220 + `/Applications` 软链
- 代码签名: 自动检测 `CSC_LINK` + `CSC_KEY_PASSWORD`;CI 跳过:`CSC_IDENTITY_AUTO_DISCOVERY=false`
- 公证: 自动检测 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`(未在 yml 写 `notarize.teamId`,v25 已 deprecated)

Windows (`electron-builder.yml:94-104`):
- target: `nsis`
- NSIS: `oneClick: false`, `perMachine: false`, `allowToChangeInstallationDirectory: true`

Linux (`electron-builder.yml:108-114`):
- target: `deb`, `rpm`(跳过 AppImage,沿用旧 CI)
- `category: Development`

发布源 (`electron-builder.yml:120-124`):
- `publish.provider: github`, `owner: kkutysllb`, `repo: KWorsk`(注释明说 repo 拼写是 `KWorsk`,与 productName `KWorks` 不一致)

### 6.2 构建脚本链

```
pnpm run build         →  tsc -p tsconfig.json (主进程 ESM)
                       +  tsc -p tsconfig.preload.json (preload CJS)
                       +  mv -f dist/preload.js dist/preload.cjs
pnpm run build:gateway →  bash scripts/build-gateway.sh
                          ├─ uv sync --extra gateway --extra browser
                          ├─ PLAYWRIGHT_BROWSERS_PATH=<staging> uv run playwright install chromium
                          ├─ uv run pyinstaller ../desktop/backend-build/kworks-gateway.spec --noconfirm --clean
                          ├─ cp -R staging/* dist/kworks-gateway/_internal/ms-playwright/   # 绕过 PyInstaller COLLECT 破坏 Chromium Mach-O
                          └─ cp -R dist/kworks-gateway/* desktop/resources/gateway/
pnpm run build:frontend → pnpm --dir ../frontend run build:desktop (Next.js static export → frontend/out)
pnpm run verify:package-resources → node scripts/verify-package-resources.mjs
                            ├─ 必查: gateway executable, _internal/config.embedded.yaml,
                            │         _internal/skills/public, frontend/out/index.html,
                            │         LocalSkillStorage 类存在
                            └─ --source-only: 仅检查源码契约(spec datas wiring 等)
electron-builder
```

`scripts/build-gateway.sh` 注释明确指出:**PyInstaller 的 `COLLECT.assemble()` 会扫描每个 data file 的 Mach-O 头并尝试 strip / re-sign,会破坏 macOS 上的 Chromium .app bundle**;所以 Chromium 走"下载到 staging → build 完成后再 `cp -R` 进 `_internal/ms-playwright`"的旁路。

### 6.3 资源自检

`scripts/verify-package-resources.mjs`:
- `SOURCE_ONLY=true` 模式只查源码契约(spec datas 是否仍含 `skills/public` / `config.embedded.yaml` / `qilin`,`frontend/next.config.js` 是否仍是 `output: "export"`,`frontend/package.json` 是否还有 `build:desktop` 脚本)
- 默认模式查产品产物(`resources/gateway/kworks-gateway` 可执行 + `_internal/` 子树 + `frontend/out/index.html` + `_next/`)

### 6.4 已发布产物 (`release/`)

```
KWorks-1.0.0-arm64-mac.zip          345 MB
KWorks-1.0.0-arm64-mac.zip.blockmap
KWorks-1.0.0-arm64.dmg              354 MB
KWorks-1.0.0-arm64.dmg.blockmap
latest-mac.yml                       (auto-update 元数据)
builder-debug.yml
mac-arm64/                           (unpacked asar)
```

`package.json` 当前 `version: 1.0.7`,但 release 目录中产出是 `1.0.0`,说明本地 `version` 尚未真正对应一次 release;`electron-updater` 在 `app.getVersion()` 与 GitHub latest 比对,本地 `1.0.7` 与 GitHub `1.0.0` 会判定 `available: true` — **可能造成用户每次启动都被提示升级**(视 GitHub 上 `KWorks-1.0.7` 是否已发布)。

### 6.5 签名 / 公证

- **macOS 代码签名**: 自动检测 `CSC_LINK` (base64 .p12) + `CSC_KEY_PASSWORD`;CI 跳过用 `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm exec electron-builder --mac`
- **macOS 公证**: v25 auto-notarizes,需要 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID` 三个 env;`notarize.teamId` 在 v25 已 deprecated,故 yml 里不写
- **macOS 旁路**: `--config.mac.notarize=false` 临时关
- **Windows 代码签名**: yml 未配置 `win.signAndOptions`,默认读取环境变量 `CSC_LINK` / `CSC_KEY_PASSWORD`(GitHub Actions 标准做法)
- **Linux**: deb/rpm 走系统包管理器,未涉及签名

---

## 7. 测试 (`tests/`)

### 7.1 测试架构

- 框架: `node:test`(`node --test`),共 16 个 `.mjs` 测试
- 风格: **大部分通过字符串匹配源码 + 少量 import 编译产物跑实际函数**(`url-policy.test.mjs`、`frontend-protocol.test.mjs`、`config-migration.test.mjs` 直接 `import "../dist/url-policy.js"` 等)
- `package.json` 没有 `test` 脚本 — 需手动 `node --test tests/`
- 重要:**测试在源码上做白盒断言,改动实现而不更新测试容易误判通过**;同时部分断言已经过期(见 §7.3)

### 7.2 测试文件清单与覆盖

| 文件 | 覆盖 |
| --- | --- |
| `window-security.test.mjs` | `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`setTemplateImage(true)`、macOS hiddenInset title bar、`backgroundColor: #0a0a0a` |
| `multi-window.test.mjs` | 多 `BrowserWindow` Set、`createAppWindow`、`createNewTaskWindow`、`second-instance` + `showLastActiveWindow`、dialog 用 `BrowserWindow.fromWebContents(_evt.sender)` |
| `single-instance.test.mjs` | `requestSingleInstanceLock` + `second-instance` |
| `shutdown.test.mjs` | `stopBackendWithTimeout` + `app.exit(0)`(已过期,见 §7.3) |
| `url-policy.test.mjs` | import `dist/url-policy.js` 实跑:`app://-/workspace` ✓、`http://127.0.0.1:18569` ✓、`file://` ✗、`javascript:` ✗ |
| `frontend-protocol.test.mjs` | import `dist/frontend-protocol.js` 实跑:RSC 路径映射、静态资源保留、`%2e%2e` path traversal 拦截 |
| `no-reuse-web-service.test.mjs` | 断言 backend.ts **不**复用已占用端口的 gateway |
| `dev-backend-ownership.test.mjs` | `KWORKS_SKIP_BACKEND_AUTOLAUNCH` 跳过 `backend.launch()`、tray 的"重启后端"在该模式下禁用 |
| `dev-launcher.test.mjs` | `scripts/dev.mjs` 行为:`scheduleGatewayRestart`、Next.js dev 等待 ready 信号、CORS 注入、`QILIN_EXTENSIONS_CONFIG_PATH`、builtin skills seed |
| `desktop-config.test.mjs` | `~/.kworks/config.yaml` 隔离 + 首次启动从 `config.embedded.yaml` 拷贝、`agents_api: enabled: true`、无 `coding_agent`、SQLite 后端、空 `extensions_config.json`、`custom/` 可写目录 |
| `config-migration.test.mjs` | import `dist/config-migration.js` 实跑:sqlite_dir 注入为 `~/.kworks/data`、idempotent、重复 `agents_api` 去重、postgres 保留、社区浏览器块字节级替换为原生 browser_tools、用户改过的社区块不动 |
| `backend-lifecycle.test.mjs` | stop 关 log stream 清 child、win32 taskkill 路径有超时 |
| `open-terminal.test.mjs` | 必须用 `node-pty` 内嵌终端,不依赖 `osascript` / 外部 shell;`terminal:start/write/resize/stop` 通道齐全 |
| `node-pty-spawn-helper.test.mjs` | `ipc.ts` 必须有 `ensureNodePtySpawnHelperExecutable`、`postinstall` 必须调 `fix-node-pty-permissions.mjs`、运行时探测 spawn-helper `+x` |
| `package-build.test.mjs` | `build:app` 必须包含 `build:gateway` + `verify:package-resources`;verify 必须检查 `resources/gateway` / `frontend/out` / `LocalSkillStorage` / `config.embedded.yaml` / `skills/public`,**不允许**包含 `skills/builtin/coding`;`tray-icons` 与 `icons` 是分开的资源 |
| `release-lifecycle-script.test.mjs` | 仓库根 `release.sh` 暴露 `--push` / `--no-watch` / `--resume` / `GitHub Actions`;委托给 `release-desktop.yml`;**桌面打包由 GitHub Actions 跑**;**不在 release.sh 内调 `pnpm run build:app`** |

### 7.3 已知测试/源码漂移(可改进点)

- **`tests/shutdown.test.mjs:12`** 断言 `main.ts` 含 `app.exit(0)`,但 `main.ts:589` 现在用 `app.quit()`(`quitApp()` 函数)以保留 Squirrel.Mac 的 `applicationShouldTerminate:` 钩子;`app.exit(0)` 已不在源码里 — 测试**会失败**
- **`tests/multi-window.test.mjs:13`** 断言主进程源码含字符串 `"新建 Coding 窗口"`;实际 `src/main.ts` 只有 `"新建聊天窗口"`(编码模式已下线) — 测试**会失败**
- **`tests/multi-window.test.mjs:14`** 断言源码**不**含 `let mainWindow: BrowserWindow | null = null` — 与现状一致,这条仍然有效

---

## 8. 可改进点 (优先级排序)

### 8.1 安全

1. **`shell:open-folder` 缺少路径校验**(`src/ipc.ts:347`)— 当前 renderer 可以让任意本地路径被 `shell.openPath` 打开。建议至少限定在 `~/.kworks` 与用户在 dialog 中已选过的路径之内;理想方案是新增一个 `recentFolders` Set,只有 dialog / drag-drop 流入的路径才允许
2. **`loadLoginShellEnv` 完全继承**(`src/backend.ts:722`)— 应当对 key 加 allowlist / blocklist(屏蔽 `LD_*`、`DYLD_*`、`BASH_FUNC_*`、`TMPDIR` 等敏感变量)防止用户 rc 错误覆盖 `PYTHONUNBUFFERED` / `PYTHONDONTWRITEBYTECODE` 或注入危险 PATH
3. **CSP**: 当前未在 BrowserWindow 上设 `Content-Security-Policy`(可通过 `session.defaultSession.webRequest.onHeadersReceived` 注入),生产环境强烈建议至少 `default-src 'self' app:-; connect-src 'self' app:- http://127.0.0.1:19987; script-src 'self'`
4. **`webSecurity` 未显式置 true** — Electron 33 默认就是 true,但建议在 `webPreferences` 里显式写出来以做 code review 友好的"安全意图声明"
5. **Updater 数字签名校验**:`electron-updater` 默认 `verifyUpdateCodeSignature` 在 macOS 是 false,建议对 macOS / Windows 显式 `autoUpdater.verifyUpdateCodeSignature = true`(尤其生产用户量大时)

### 8.2 测试

6. 修复 `tests/shutdown.test.mjs:12`:`assert.match(mainSource, /app\.exit\(0\)/)` 改成 `app\.quit\(\)` 或断言 `quitApp()` 函数存在
7. 删除 `tests/multi-window.test.mjs:13` 的 `"新建 Coding 窗口"` 断言(或在 `main.ts` 里恢复该菜单项)
8. 加一个跑通的"happy-path"集成测试:`build:app` → `electron-builder --dir` → 用 Playwright/electron 启动 → 截图 → 校验启动时间 < 5 s
9. `dev-launcher.test.mjs:43` 校验了 `GATEWAY_CORS_ORIGINS: DESKTOP_DEV_ORIGINS`,但没有断言 `QILIN_DESKTOP_DEV: "1"` 与 production 不会同时被注入 — 加一个断言确保生产 spawn 时这两个 env 不存在
10. `config-migration.test.mjs` 没覆盖空文件 / 全注释文件 / 缺 database 段的 corner case — 加一两条

### 8.3 工程

11. **统一 dev launcher 与生产 backend 启动协议**:`scripts/dev.mjs` 用了大量自写逻辑(process group kill / `Ready in` 字符串匹配),与 `src/backend.ts` 的 `BackendManager` 是两套。建议让 `dev.mjs` 直接调 `BackendManager` 的内部方法,或者反过来抽出一个 `GatewaySupervisor` 接口被两个地方复用
12. **`startEmbeddedTerminal` 缓存**:`terminalProcesses: Map` (`src/ipc.ts:79`) 没有按 renderer 销毁事件清空 `onExit` 后仍未清理的 socket — `stopTerminalsForOwner` (`src/ipc.ts:203`) 已经做了,但它要求 `owner.isDestroyed()`;若 owner 是 not-destroyed 但 webContents reload,会出现悬挂的 PTY
13. **Updater 镜像可观测**:`setupGitHubReleaseMirror` (`src/updater.ts:90`) 失败时只 `log.warn`,没有 metric / 统计 — 大陆用户频繁失败时没有外部信号
14. **无 e2e 测试覆盖 RSC**: `frontend-protocol.test.mjs` 只测路径解析,没测 `protocol.handle` 的 RSC 分支 → 真实 Next.js 流式渲染的失败只能人工复现。建议加一个 mock `request.headers.get` 的 fastify-style 集成测试
15. **`package.json` 没有 `test` 脚本** — 应该加 `"test": "node --test tests/"` 让 CI 一键跑;测试已就绪但调用入口散落
16. **版本号不一致**: `package.json:version=1.0.7` 与 `release/` 目录里 `1.0.0` 错位,会让 `electron-updater` 在已装 1.0.7 的用户机器上误判有新版本。建议在 release 脚本里强制 `git tag v$(jq -r .version package.json)` 与发布一致

### 8.4 进程模型

17. **`app.requestSingleInstanceLock` 失败时**(`src/main.ts:74`)立刻 `app.quit()`,但后续 `app.whenReady()` 仍会执行(`src/main.ts:594` 没有 lock 守卫)。实际代码里 `if (!gotSingleInstanceLock) return;` 守住了 (`src/main.ts:595`),但 `app.quit()` 同步 vs 异步的语义在新版本 Electron 上不稳 — 建议改成 `app.exit(0)` 立刻终止
18. **`backend.ts:533 migrateLegacyUserData` 用 `dialog.showMessageBoxSync`**: 在 `before-quit` / 任何非 `app.whenReady` 之后调会抛,目前 OK(只在 launch 开头),但应加注释或挪到 `whenReady` 内显式阶段
19. **`child.once("exit", ...)` 注册在 `wireProcessIO()` 之后**:`launch()` 流程是 `spawn → wireProcessIO → once("exit")` (`src/backend.ts:158-179`),`spawn` 与 `once` 之间没有竞争条件,但中间抛异常会留下未挂 `exit` 的孤儿。建议用 `try/finally` 把 `child.once("exit", ...)` 注册放在 spawn 之后第一步

### 8.5 打包发布

20. **`repo: KWorsk`**(`electron-builder.yml:123`)的拼写与产品名不一致,虽然 GitHub repo URL 真的叫 KWorsk(注释自承),但后续如果迁移 repo 会断 update;建议在 GitHub repo 端做个 redirect 或 README 写明
21. **`extraResources` 的 `frontend-out/`** 体积大(静态导出约几十 MB),是否考虑改用 `asar` 压缩?当前 `files` 列表默认不打包 `frontend-out`(因为在 extraResources),如果改成 `asarUnpack` 列表可以小一些
22. **`dmg.title: "${productName} ${version}"`**: `productName=KWorks`,`version=1.0.7`,最终 DMG 名 `KWorks 1.0.7`,但实际 release 出来的文件名是 `KWorks-1.0.0-arm64.dmg`(Kebab-case)。`dmg.title` 控制的是 DMG 挂载后卷标的标题(出现在 Finder 顶栏),不影响文件名 — 没问题,但容易混淆。建议在 README 标注这个差异

---

## 9. 总结

KWorks desktop 是一个典型的 Electron + Python 子进程架构,核心亮点:

- **强隔离**:`contextIsolation + sandbox + nodeIntegration: false` 三件套齐备,所有系统能力走 `contextBridge` 命名空间化通道
- **状态机清晰**:`BackendManager` 用 EventEmitter + 单 child 引用 + 健康探针,生命周期内的事件(legacy 迁移 / config-migration / JWT secret 持久化 / 登录 shell env 继承)都被显式处理
- **跨平台语义对齐**:`will-navigate` / `setWindowOpenHandler` / `app://` 协议 / `taskkill` vs SIGTERM 三层差异都被显式处理
- **开发者体验**: `dev.mjs` 用 detached 进程组 + `Ready in` 文本匹配同步 Next.js 与 Electron,避免 `setTimeout(..., 4000)` 这种脆性等待

主要风险面集中在 `loadLoginShellEnv` 过度继承、`shell:open-folder` 无路径校验、以及若干测试与源码漂移未修复 — 都是可以在不破坏现有架构的前提下收敛的小问题。