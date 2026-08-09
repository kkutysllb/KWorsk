---
name: a-stock-screener
description: |
  A 股对话式选股助手 (Orchestrator Pattern) —— 用户用自然语言描述"想要什么样的股票"，
  本 skill 解析意图 → 选择策略 → 拉取数据 → 套用过滤 → 多因子打分 → 输出选股报告。
  内置 10 种经典选股策略（价值/高股息/成长/动量/技术突破/超跌反弹/涨停龙头/机构资金追踪/
  缠论背驰/多因子横截面），工作流五阶段编排，支持无网络 mock 模式离线运行。
  适用于 stock-analysis / factor-research / selection-strategies / data-fetch
  等 skill 的上层"选股入口"场景。
version: 1.0.0
author: kk-quant
license: MIT
category: finance
keywords: stock-screener, a-share, orchestrator, natural-language, selection, screening, factor

capabilities:
  - id: intent-parsing
    description: "自然语言 → 策略意图解析：识别策略类型、市值范围、行业、TopN 等参数"
  - id: strategy-registry
    description: "策略注册中心：内置 10 种选股策略，支持按关键词/参数动态匹配"
  - id: workflow-orchestration
    description: "5 阶段工作流编排：意图确认→数据获取→策略过滤→因子打分→报告生成"
  - id: data-adapter
    description: "数据适配层：封装 tushare/AKShare/iWencai 等数据源，提供统一 pandas DataFrame 接口"
  - id: multi-factor-ranking
    description: "多因子打分排序：Z-score 标准化 + 加权求和 + TopN"
  - id: report-generation
    description: "结构化报告输出：委托 common/analysis-report 生成 Markdown + 暗色/亮色双主题 HTML 看板"
  - id: mock-mode
    description: "无网络 mock 模式：生成伪 A 股数据用于离线测试与冒烟验证"
  - id: cli-entry
    description: "命令行入口：python -m scripts.cli --query '<自然语言>' --top 10"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  packages: ["pandas", "numpy"]
required-secrets:
  - TUSHARE_TOKEN
  - IWENCAI_API_KEY

inputs:
  - name: query
    type: string
    required: true
    description: "用户的自然语言选股请求，如 '高股息低估蓝筹股' / '创业板成长股' / '涨停板龙头'"
  - name: top_n
    type: integer
    required: false
    description: "返回结果数量，默认 10"

tags:
  - finance
  - stock-screener
  - A-share
  - orchestrator
  - factor
  - selection


package:
  type: python
  entry: scripts/data_adapter.py
metadata:
  openclaw:
    emoji: "🧭"
    version: "1.0.0"
    author: "kk-quant"
    category: "finance"
    tags:
      - finance
      - stock-screener
      - A-share
      - orchestrator
      - factor
      - selection
    requires:
      bins: ["python3"]
      packages: ["pandas", "numpy"]
    install:
      - id: pip-deps
        kind: pip
        package: "pandas numpy"
        python: python3
---
