# -*- mode: python ; coding: utf-8 -*-
"""KWorks gateway PyInstaller spec（onedir）。

把 gateway（含全部 Python 依赖、内置技能包、配置模板）打包为自包含目录
``dist/kworks-gateway/``，作为 Electron 桌面端的内置后端随安装包分发
（electron-builder extraResources），实现真正的开箱即用（无需用户安装
Python / 依赖）。

构建命令（由 desktop/scripts/build-gateway.sh 调用）：
    cd qilin && uv run pyinstaller ../desktop/backend-build/kworks-gateway.spec --noconfirm --clean

打包态资源布局（与 desktop/src/paths.ts 的解析约定对应）：
    kworks-gateway/
      kworks-gateway(.exe)    # 可执行文件（启动器，见 desktop/scripts/run_gateway.py）
      _internal/
        skills/public/        # 内置技能包（桌面端首次启动种子化到 ~/.kworks/skills）
        config.embedded.yaml  # 桌面默认配置模板
        qilin/  app/          # 引擎与 gateway 的数据文件（alembic、模板等）
"""
from pathlib import Path
import os

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

spec_dir = Path(SPECPATH).resolve()          # desktop/backend-build/
repo_root = spec_dir.parent.parent           # KWorks 仓库根
desktop_dir = repo_root / "desktop"
qilin_root = repo_root / "qilin"

# macOS 签名：electron-builder 不会递归签名 extraResources 内的 Mach-O，
# 必须在此预签 gateway 内嵌二进制（CI 传 APPLE_SIGNING_IDENTITY，
# 格式 "Developer ID Application: 名字 (TeamID)"）。本地构建不传则免签。
codesign_identity = os.environ.get("APPLE_SIGNING_IDENTITY") or None
if codesign_identity:
    print(f"[kworks-gateway.spec] using APPLE_SIGNING_IDENTITY for PyInstaller macOS signing")

print(f"[kworks-gateway.spec] repo_root = {repo_root}")

datas = [
    # 内置技能包：legacy public/ 布局（desktop/src/paths.ts 的
    # getBundledSkillsDir / getBundledBuiltinSkillRoots 优先读 builtin/，
    # 缺失时回退 public/；desktop/src/backend.ts initSkills 会把 public/
    # 种子化到 ~/.kworks/skills/builtin/task）。
    (str(repo_root / "skills" / "public"), "skills/public"),
    # 桌面默认配置模板（config-migration.ts 首次启动复制到 ~/.kworks/config.yaml）
    (str(spec_dir / "config.embedded.yaml"), "."),
    # 引擎数据文件（alembic 迁移脚本、assets 模板等不随 import 链收集）。
    # 注意：只收集数据文件（collect_data_files 自动排除 .py），绝不把
    # 引擎源码树整体复制进 _internal —— onedir 的 _MEIPASS 在 sys.path 上，
    # datas 里的 .py 会 shadow PYZ 模块，导致冻结态模块从文件加载并触发
    # 与顶层 mcp（MCP SDK）的导入混淆（qilin.mcp ↔ mcp 循环导入）。
    # alembic 迁移脚本（persistence/migrations/versions/*.py）是 .py 数据，
    # 必须用 include_py_files + includes 显式收集，否则启动时
    # "alembic has no head revision"。
    *collect_data_files(
        "qilin",
        include_py_files=True,
        includes=[
            "persistence/migrations/**",
            # skill storage 实现以文件形式打包（verify-package-resources
            # 断言其存在；引擎运行时也可从文件系统访问）。includes 路径
            # 相对包根（qilin/），故为 skills/... 而非 qilin/skills/...。
            "skills/storage/**",
        ],
    ),
    *collect_data_files("app"),
    (str(qilin_root / "extensions_config.example.json"), "."),
]

# 引擎按配置字符串动态 import 的模块区域（config.yaml 的 tools/use 字段、
# 子代理分派、模型 provider 等），静态 import 链看不到，必须显式收集：
#   - qilin.models.*            config.yaml models[].use: "qilin.models.xxx:Class"
#   - qilin.community.*         config.yaml tools[].use: "qilin.community.xxx.tools:xxx"
#   - qilin.subagents.builtins.*  子代理分派（task 工具）
#   - qilin.tools.builtins.*    内置工具（部分按需注册）
#   - qilin.skills.*            技能子系统（storage/installer/review）
#   - mcp（MCP SDK 顶层包）     必须显式收集：qilin.mcp.session_pool 的
#     `from mcp import ClientSession` 需要顶层 mcp 包；若缺失，冻结态会把
#     `mcp` 解析为同名的 qilin.mcp 子包，触发循环导入。
hiddenimports = [
    # mcp.cli 是 MCP SDK 的命令行入口，import 时对非交互环境直接 sys.exit(1)，
    # collect_submodules 枚举会失败——gateway 不需要它，过滤掉。
    *collect_submodules("mcp", filter=lambda name: not name.startswith("mcp.cli")),
    *collect_submodules("qilin.mcp"),
    *collect_submodules("qilin.models"),
    *collect_submodules("qilin.community"),
    *collect_submodules("qilin.subagents.builtins"),
    *collect_submodules("qilin.tools.builtins"),
    *collect_submodules("qilin.skills"),
]

a = Analysis(
    [str(desktop_dir / "scripts" / "run_gateway.py")],
    pathex=[str(qilin_root)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "pytest",
        "_pytest",
        "tkinter",
        "test",
        "tests",
    ],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="kworks-gateway",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    # windowed exe：避免被 GUI 父进程 spawn 时弹出可见 console 黑窗；
    # 日志由 Electron 主进程重定向 stdout/stderr 到 gateway.log。
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=codesign_identity,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="kworks-gateway",
)
