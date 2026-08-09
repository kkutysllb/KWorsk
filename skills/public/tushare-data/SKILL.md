---
name: tushare-data
description: Tushare 官方数据适配技能——A 股/指数/ETF/基金/期货/期权/财务/估值/资金流/宏观全量数据获取的唯一官方入口，分析类技能必须通过本技能或 common.finance_data_gateway 间接调用，禁止直接 import tushare
version: 1.1.16
author: tushare.pro
license: Official Tushare Skill terms
category: finance

package:
  type: python
  entry: scripts/stock_data_demo.py
capabilities:
  - id: market-data
    description: "行情数据：daily/weekly/monthly/pro_bar/stk_mins，A 股/指数/ETF/基金/期货/期权日线与分钟行情"
  - id: fundamentals
    description: "基本面数据：stock_basic/fina_indicator/income/balancesheet/cashflow/forecast/express/dividend"
  - id: valuation
    description: "估值数据：daily_basic（PE/PB/股息率/总市值）"
  - id: capital-flow
    description: "资金流数据：moneyflow/moneyflow_hsgt/hsgt_top10/top_list/top_inst/margin/margin_detail"
  - id: macro-data
    description: "宏观数据：cn_cpi/cn_ppi/cn_pmi/cn_gdp/cn_m/shibor/shibor_lpr/us_tycr"
  - id: data-export
    description: "数据导出：CSV/parquet，按标的+日期分段拉取、去重、排序、命名规范"

permissions:
  network: true
  filesystem: true
  shell: true
  env:
    - TUSHARE_TOKEN

requires:
  bins: ["python3"]
  packages: ["tushare", "pandas"]
  env: ["TUSHARE_TOKEN"]
required-secrets:
  - TUSHARE_TOKEN

metadata:
  openclaw:
    emoji: "📊"
    version: "1.1.16"
    author: "tushare.pro"
    category: "integration"
    tags:
      - finance
      - tushare
      - data-source
      - integration
    requires:
      bins: ["python3"]
      packages: ["tushare", "pandas"]
      env: ["TUSHARE_TOKEN"]
      network: true
    install:
      - id: pip-deps
        kind: pip
        package: "tushare pandas"
        python: python3
        label: "Install Tushare Pro SDK"

tags:
  - finance
  - tushare
  - data-source
  - integration
---
