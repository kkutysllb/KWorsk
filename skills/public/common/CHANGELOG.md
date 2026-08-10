# Changelog

## [1.2.0] - 2026-08-05

### Added
- `finance_data_gateway` 新增 4 个接口：`stk_surv`（机构调研明细）、
  `stock_company`（上市公司基本信息）、`report_rc`（业绩快报）、
  `cyq_chips`（每日筹码分布）。

## [1.1.1] - 2026-08-05

### Fixed
- `tushare_client`：兼容小写频率参数（daily/weekly/monthly → D/W/M），修复
  tushare 库 `pro_bar` 内部各频率分支均不命中导致的 `UnboundLocalError`。
- `tushare_client`：用 `redirect_stdout` 隔离 tushare 库 `pro_bar` 内部裸
  `print(e)` 对 stdout 的污染，避免破坏 JSON 等结构化输出。
- `tushare_client.stock_basic`：支持按 `ts_code` / `name` 过滤（与官方接口一致）。

## [1.1.0] - 2026-07-25

### Added
- 新增 `finance_data_gateway` 模块：`FinanceDataGateway` / `TushareDataAdapter` /
  `get_finance_data_gateway()` / `reset_finance_data_gateway()`，显式封装全部 49 个
  常用 Tushare 接口（股票/财务/股东/指数/资金流/基金/期货/期权/宏观）。
- `__init__` 导出 gateway 四个符号。
- SKILL.md 声明数据访问边界：分析技能禁止直接 `import tushare`，必须通过本网关访问。

### Changed
- 描述、版本号、capabilities、tags 同步反映 finance-data-gateway 能力。

## [1.0.0] - 2026-07-03

### Added
- Initial standardized package structure.
