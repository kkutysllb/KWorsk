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

## 产品路线立场

**桌面单机优先（local-first）**：当前所有迭代以"本地一台机器上的个人 AI 工作区"为第一目标 —— 数据本地、引擎本地、可见可审计。

麒麟引擎自带的服务面能力（FastAPI gateway 的多用户/RBAC、飞书/Discord 等 8 大渠道接入）作为**可选部署形态**维护，不承担当前主线迭代；两条路线共享引擎内核，避免双线摊薄。

## Roadmap

**已完成（近期）**
- 对话闭环：重新生成 / 编辑重发（checkpoint 回放）、消息队列、断线重连
- 执行过程呈现：思考与工具调用按执行顺序交错、默认折叠、中文工具标签
- 人机协作：澄清卡（已答回显）、危险工具人工审批门（`tool_approval`）
- 交付预览：HTML / Markdown / XLSX / DOCX / PPTX / 代码 / PDF / 图片
- 会话审计：文件变更面板（新建/修改/删除 + diff，敏感文件脱敏）
- 工具生态：原生 Playwright 浏览器三工具、Slash 命令选择器、技能市场
- 工程质量：后端 570+ 测试（含沙箱路径安全 / 凭证脱敏回归）

**进行中 / 规划**
- 多智能体产品化：编排模式免重启切换、编排关系可视化
- 记忆：qilinmem 检索质量与写入去重增强
- 交互式本地浏览器（可见 Chrome + 扫码登录接力）—— 评估中
- 邮件（IMAP/SMTP）与办公文档生成工具组
- KStock 等自研应用的本地自动化接口对接

## 已知问题

- 网页版微信对部分账号禁用登录，浏览器工具无法绕过该平台限制；涉及微信生态优先评估官方 API。
- PDF 内嵌渲染依赖 Chromium 内建引擎，个别异常文件会落入错误态（提供下载兜底）。
- 超大 XLSX/PPTX 预览在低端机器上可能卡顿。
- Windows/Linux 安装包的签名与公证仅在 CI 发布流水线完成，本地自建包未签名。

## 许可证

MIT
