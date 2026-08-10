r"""KWorks gateway 启动入口（PyInstaller onedir）。

在打包后的 gateway 目录中直接启动内置 FastAPI gateway：

    kworks-gateway              # 可执行文件（无参数）

环境约定
--------
桌面端（Electron 主进程）在 spawn 本进程前会注入完整运行环境（见
``desktop/src/backend.ts`` 的 ``buildEnv``）：

- ``QILIN_HOME`` / ``QILIN_HOST_BASE_DIR`` → ``~/.kworks``（用户数据根）
- ``QILIN_CONFIG_PATH``          → ``~/.kworks/config.yaml``
- ``QILIN_EXTENSIONS_CONFIG_PATH`` → ``~/.kworks/extensions_config.json``
- ``QILIN_SKILLS_PATH``          → ``~/.kworks/skills``（首次启动由桌面端
  从打包的技能目录种子化）
- ``GATEWAY_HOST`` / ``GATEWAY_PORT`` / ``GATEWAY_LOG_LEVEL``

本入口只负责解析这些环境变量并启动 uvicorn，不做任何目录/配置初始化
（那些属于桌面端主进程的职责，避免双份逻辑漂移）。

打包态资源布局（与 kworks-gateway.spec 对应）
--------------------------------------------
onedir 布局下 ``sys._MEIPASS`` 指向 ``_internal/``，其中包含：
- ``skills/public/``     内置技能包（桌面端首次启动种子化到 ~/.kworks/skills）
- ``config.embedded.yaml`` 桌面默认配置模板
- ``qilin/``、``app/``  引擎与 gateway 的数据文件
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# 冻结（PyInstaller）态下资源根为 _internal；源码态为仓库根。
# 注意：绝不把 qilin 目录插入 sys.path —— 冻结态 _internal/qilin 会被
# PyInstaller 的 finder 当作 "qilin" 前缀，导致 `import mcp`（MCP SDK）
# 被错误解析为 qilin.mcp，触发循环导入。
if getattr(sys, "frozen", False):
    REPO_ROOT = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
else:
    REPO_ROOT = Path(__file__).resolve().parent.parent.parent

import uvicorn  # noqa: E402

from app.gateway.app import app  # noqa: E402


def main() -> None:
    host = os.environ.get("GATEWAY_HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("GATEWAY_PORT", "19987"))
    except ValueError:
        port = 19987
    log_level = os.environ.get("GATEWAY_LOG_LEVEL", "info")

    uvicorn.run(app, host=host, port=port, log_level=log_level)


if __name__ == "__main__":
    main()
