---
name: common
description: kk_Skills 公共库——金融数据网关（FinanceDataGateway）+ iWencai/Tushare 统一客户端 + 金融分析格式化工具集；分析技能必须通过 get_finance_data_gateway() 访问 Tushare，禁止直接 import tushare
version: 1.1.0
author: kk-quant
license: MIT
category: finance


package:
  type: knowledge-only
capabilities:
  - id: iwencai-client
    description: "同花顺问财 OpenAPI 统一封装：HMAC 签名 + Trace-Id + 翻页 + 统一错误处理"
  - id: tushare-client
    description: "Tushare Pro 全量接口封装：自动限速、环境变量密钥管理、股票/期货/ETF/宏观全覆盖"
  - id: finance-data-gateway
    description: "金融数据网关：分析技能访问 Tushare 的首选入口，方法名与官方接口一致，实现可替换，支持单测注入 mock"
  - id: formatters
    description: "金融分析格式化工具集：百分比/进度条/信号标记/趋势图标/评分条/Markdown表格/技术指标格式化"

permissions:
  network: true
  filesystem: false
  shell: false
  env:
    - TUSHARE_TOKEN
    - IWENCAI_API_KEY

requires:
  packages: ["pandas", "python-dotenv", "tushare"]
  bins: ["python3"]
  env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]
required-secrets:
  - TUSHARE_TOKEN
  - IWENCAI_API_KEY

metadata:
  openclaw:
    emoji: "🧩"
    version: "1.1.0"
    author: "kk-quant"
    category: "library"
    tags:
      - library
      - common
      - tushare
      - iwencai
      - finance-data-gateway
      - formatters
    requires:
      bins: ["python3"]
      env: ["TUSHARE_TOKEN", "IWENCAI_API_KEY"]

tags:
  - library
  - common
  - tushare
  - iwencai
  - finance-data-gateway
  - formatters
---

# common

kk_Skills 公共库。提供金融数据网关、iWencai / Tushare 统一客户端与金融分析格式化工具集，供股票类技能复用。

## 数据访问边界（强制）

本仓库所有分析类技能获取 Tushare 数据时，**必须遵循以下边界，禁止绕过**：

1. **唯一允许直接 `import tushare` 的位置**：
   - `tushare-data` 技能（官方适配包）
   - 本库 `tushare_client.py` 的实现内部
2. **其余所有分析脚本**禁止 `import tushare` / `ts.pro_api()`，必须通过以下方式访问：
   ```python
   # 首选：金融数据网关（方法名与 Tushare 官方接口一致，实现可替换）
   from kk_common import get_finance_data_gateway
   gw = get_finance_data_gateway()
   df = gw.daily(ts_code='600519.SH', start_date='20260101', end_date='20260725')

   # 备选：兼容客户端（含显式参数签名的封装方法）
   from kk_common import get_tushare_client
   client = get_tushare_client()
   df = client.daily(ts_code='600519.SH')
   ```
3. `FinanceDataGateway` 封装了全部 49 个常用 Tushare 接口（股票/财务/股东/指数/资金流/基金/期货/期权/宏观），实现由 `FinanceDataAdapter` 注入，单元测试可注入 mock，后续可无缝切换到 `tushare-data` 官方运行时。
4. 缺少 token / 接口权限时返回空 DataFrame，**禁止编造数据**。

详见 [README.md](./README.md)。
