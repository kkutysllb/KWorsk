# Changelog

## v1.0.9 - 2026-08-23

Compare: `v1.0.8...v1.0.9`

- chore(qilin): bump submodule to qilinmem config fixes (eea65a2)
- fix(frontend): lift settings header into Windows titlebar drag region (df9d3df)
- fix(desktop): map Next 16 directory-style RSC payloads to fix blank page on Explore navigation (f700ba0)

## v1.0.8 - 2026-08-23

Compare: `v1.0.7...v1.0.8`

- 增加调试代码目录忽略 (fe65446)
- chore: tray icon size, frameless overlay sync, settings UI (d08e75c)
- 清理代码中残留调试日志代码 (00be1d3)

## v1.0.7 - 2026-08-18

Compare: `v1.0.6...v1.0.7`

- 忽略上传图片文档 (b44b974)
- feat(workspace): group sidebar history by recent3/week/month/earlier (4dd891b)
- feat(i18n): add sidebar history bucket labels (a6bcef2)
- feat(datetime): add bucketOfThread sidebar grouping helper (7d89430)
- 完成附件上传前端样式修改 (cdf37df)

## v1.0.6 - 2026-08-15

Compare: `v1.0.5...v1.0.6`

- feat: P0/P1 产品完善 — 对话闭环、预览器、审计视图 + 后端审批/浏览器/安全测试 (5a00ad4)
- 修复完善前端UI的样式和排版 (4c4d19b)

## v1.0.5 - 2026-08-12

Compare: `v1.0.3...v1.0.5`

- fix: overlay 预览层分离拖拽区与内容区，修复 xlsx tab 及所有交互被吞事件 (5cc097d)
- fix: rewrite xlsx renderer with clean state management (f170be9)
- fix: hide entire ArtifactHeader in overlay mode — remove all legacy icons (0c41687)
- fix: xlsx tabs still unclickable + remove select dropdown arrow (d8fd7a3)
- fix: artifact preview header overlaps macOS traffic lights (d309728)
- fix: xlsx tab click — use ref-based rendering instead of dangerouslySetInnerHTML (3998cac)
- fix: xlsx tab buttons unclickable — extract table from full HTML doc (f0558cc)
- fix: hide code/preview toggle for office files — single eye icon is visual noise (5487d95)
- fix: xlsx sheet selector unclickable — replace Radix Select with tab buttons (317076a)
- fix: add three.js dependency required by pptx-vanilla-viewer SmartArt 3D module (22d6ea7)
- fix: switch pptx-react-viewer → pptx-vanilla-viewer to avoid @ai-sdk/react dependency (127b64c)
- feat: add office file preview (xlsx/docx/pptx) in artifact panel (b071c64)
- chore(release): v1.0.4 (bebbf57)
- fix: collect entire qilin package in PyInstaller to eliminate dynamic-import failures (4e5beb2)

## v1.0.4 - 2026-08-12

Compare: `v1.0.2...v1.0.4`

- fix: collect entire qilin package in PyInstaller to eliminate dynamic-import failures (31a6ba6)
- fix: add qilin.sandbox and other dynamic-loaded packages to PyInstaller hiddenimports (59051fd)

## v1.0.3 - 2026-08-12

Compare: `v1.0.2...v1.0.3`

- fix: add qilin.sandbox and other dynamic-loaded packages to PyInstaller hiddenimports (59051fd)

## v1.0.2 - 2026-08-11

Compare: `v1.0.1...v1.0.2`

- 修复前端bug (1ba7697)

## v1.0.1 - 2026-08-11

Compare: `v1.0.0...v1.0.1`

- feat: update welcome page and i18n locale types (46fcd98)
- fix: add credential usage guidance to finance skill SKILL.md (7c2459d)
- feat: sandbox credential passthrough UI in Tools & Sandbox settings (10fc15d)
- feat(settings): collapse the whole memory-facts card as one block (89ad778)
- Revert "feat(settings): collapse long memory facts in the fact-manager list" (6173d51)
- feat(settings): collapse long memory facts in the fact-manager list (cc8fa01)

## v1.0.0 - 2026-08-10

Compare: `v1.0.0`

- build(release): exclude thread-stream-cache from release smoke tests (c79fc88)
- test: sync unit tests with settings/skill/token refactors (7e2b578)
- build(release): wire v1.0.0 desktop packaging pipeline (d9b3145)
- feat(report): html-report skill suite + inline chat report cards (edcfde3)
- feat(welcome): minimal new-thread hero with KWorks watermark + tagline (399d6bf)
- feat(artifacts): full-screen preview overlay with download / back buttons (a15c172)
- fix(chat): polish message area, spinner, subagent timeline, settings theming (c7774fb)
- feat: AI-guided agent creation, clarification card, renderer perf fix, reviewer builtin (86acfc1)
- feat: add common skill package (kk_common) for iWencai/Tushare unified clients (c1c32c9)
- feat(automation): rename sidebar to 自动化 and wire to /api/scheduled-tasks (6abce1f)
- feat(right-panel): add draggable resize handle for right context panel (39b956b)
- feat(chat): replace flywheel spinner with neural-wave animation (6eec087)
- feat(desktop): maximize window on startup (5b2418a)
- 修复过渡动画重复展示 (f73d3ed)
- fix(right-panel): clear stale subagent tasks on thread switch (06ce1fb)
- fix(right-panel): wire skills section to backend skill_context channel (d005821)
- docs(settings): clarify subagent max_turns description with builtin defaults (e26a555)
- docs(subagents): sync general-purpose max_turns=200 in frontend docs (9c58460)
- feat(chat): 重构消息渲染为分段模型，修复中间过程展示与 JSON 泄漏 (5eab5fe)
- feat(skills): dual-mode skill install + workspace UI updates (a89a146)
- chore: bump qilin for lenient sandbox.environment $VAR resolution (85cdc7f)
- chore: bump qilin for sandbox.environment allowlist restore (695e9ef)
- 修复（workspace/sidebar-resize-handle.tsx）： (2ca0844)
- chore: remove 6 sina-finance (zm-*) skills and X_AUTH_TOKEN credential (e305ed6)
- feat(skills): add required-secrets to 6 zm-* skills + bump qilin (d609c8f)
- chore: update qilin submodule - sandbox.environment 白名单豁免密钥清洗 (0a46347)
- fix: 技能列表为空 + 删除渠道管理菜单 + 清理 legacy dev 连接 (cdd1f82)
- 修改前端消息展示样式 (58425da)
- fix(config): loadConfigSection 404 时静默降级到默认值 (a0deac4)
- fix(settings): cron_management key 改为 scheduler (ebae918)
- refactor(settings): 移除常规设置中的高级 YAML 编辑器分组 (288eeda)
- feat: 数据源配置修复 + MCP 预设修复 + 新增金融技能 (928c09d)
- fix(mcp): mcp-server-git 也需 pin mcp 版本 (1b88428)
- fix(mcp): 修复 derivePresetName 推导导致预设重复显示 (62519e2)
- feat(mcp): 添加 context7 内置预设 + 修复 derivePresetName 推导 (8d731f8)
- fix(mcp): 修复内置 MCP 预设启动失败 (128acf2)
- feat(mcp): 新增新浪财经 MCP 预设 + 数据源 404 修复 + 凭证管理 (d2ca912)
- feat(settings): 新增 MCP 管理设置菜单 + 内置预设 + 侧边栏直链 (4b89ecb)
- refactor(settings): 将系统配置菜单拆解到常规设置，删除系统配置入口 (bced0c0)
- feat(settings): 新增附件上传设置菜单 (4ca1527)
- feat(settings): 新增 Web 工具设置菜单 + 全局代理配置 (10d9824)
- feat(desktop): 启用浏览器自动化工具（playwright + Chromium 已安装） (d2870a5)
- fix(desktop): config.embedded.yaml 补齐 tools + tool_groups 声明 (c442160)
- fix: 更新 qilin 子模块 - 标准化 ruamel 类型防止 CommentedSet 序列化失败 (c8a31f9)
- feat(settings): 新增工具与沙箱设置菜单 (a65ab06)
- 完成前端新任务页面的新布局设计 (4c699cc)
- feat(settings): move token usage dashboard to settings page with cache hit stats (dfd77c1)
- feat(settings): add Token usage & budget settings page (21318e0)
- feat: tray icon template mode + sidebar default open + skills update (cbb86da)
- fix(memory-form): clamp max_injection_tokens to 100–8000 backend limit (3821641)
- feat(settings): add memory facts data management panel (8aa75d1)
- fix(forms): merge defaults over partial API data to prevent uncontrolled inputs (cc9b12b)
- feat(settings): redesign memory & summary settings page (b98b875)
- chore: bump qilin submodule + refresh skills/public matrix (52de65e)
- feat(sidebar): show last-activity timestamp on history items (0ea63da)
- fix(frontend): correct run_events backend options and add max_trace_content field (133f40d)
- feat(frontend): rewrite database form with full field set and reload badges (9ceecd5)
- refactor(frontend): remove database/run_events subnav and reuse shared restart hook (d9bf5bc)
- feat(frontend): register dataPersistence nav item with i18n labels (341d53e)
- feat(frontend): add data and persistence top-level settings page (3a4071e)
- feat(frontend): add data directory usage table component (57a15a2)
- feat(frontend): add persistence status dashboard component (e68a52c)
- refactor(frontend): extract useApplyAndRestart shared hook (20441e4)
- feat(frontend): add persistence API client and types (f88b263)
- 完成模型管理配置和前端流式输出 (6e2df2c)
- fix: 配置系统加固 + 端口迁移 + dev 模式 .env 注入 + 帮助菜单改造 (d6448ea)
- feat(settings): 新增模型管理菜单，模板卡片预填 provider (a4d325b)
- 修改设置页面返回应用的布局位置 (2825cf2)
- refactor(settings): 合并账号与外观为常规菜单，紧凑化表单设计 (823f718)
- refactor(settings): 重构设置页为全屏分组导航视图 (e5dbf47)
- 删除通知菜单功能 (5d6b3e8)
- refactor(landing): 重做落地页视觉与布局 (a2b7976)
- refactor: 删除前端所有工作模式(work-mode)代码 (f1cc552)
- 修改侧边栏底部点击用户图标弹出的菜单区域不要占用主界面区域，在侧边栏内部区域弹出 (7b5a6a6)
- 修改侧边栏底部点击用户图标弹出的菜单区域不要占用主界面区域，在侧边栏内部区域弹出 (c62c504)
- feat: 品牌重命名 KWorks + workspace 布局重构 + 接入 QiLin 引擎 (cddec90)
- 删除老项目脚本文件 (67f8a4d)
- 删除start.sh老项目管理脚本 (df2d5f0)
- first commit (f9772a3)

