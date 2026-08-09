---
name: zm-fund-analysis
description: 对基金做业绩、持仓、风险、基金经理、基金公司综合分析，支持自然语言问句输入，返回相关基金理财数据结果。当用户询问基金查询、基金业绩、基金持仓、基金风险、基金经理、基金公司分析等基金理财相关问题时，必须使用此技能。
---

# fund-analysis — 基金综合分析

> 覆盖基金业绩、持仓、风险、基金经理、基金公司五大维度，支持自然语言问句输入。

## 使用方式

1. 若用户提供的是基金名称/关键词而非代码，先调用 `scripts/search_fund.py` 搜索确认 symbol，再继续。
2. 根据用户问题类型，选择下方对应脚本调用（可并行调用多个）。
3. 解析返回结果，用自然语言向用户呈现分析结论。

### 问题类型 → 脚本映射

| 用户问题类型 | 使用脚本 | 关键参数 |
|---|---|---|
| 基金是什么 / 基本信息 | `call_fund_info.py` | `symbol` |
| 业绩表现 / 回报率 / 排名 | `call_fund_cum_return.py` | `symbol` |
| 历史净值走势 | `call_fund_networth.py` | `symbol` |
| 风险指标 / 最大回撤 / 夏普 / 波动率 | `call_fund_core_metrics.py` | `symbol` |
| 持仓 / 重仓股 | `call_fund_heavy_stock.py` | `symbol` |
| 持仓 / 重仓债券 | `call_fund_heavy_bond.py` | `symbol` |
| 持仓 / 重仓基金（FOF） | `call_fund_heavy_fund.py` | `symbol` |
| 行业配置 / 行业分布 | `call_fund_industry_alloc.py` | `symbol` |
| 资产配置 / 大类资产 | `call_fund_asset_alloc.py` | `symbol` |
| 基金经理 / 经理背景 / 任职表现 | `call_fund_manager_detail.py` | `pscode`（从 fund_info 的 manager[].pcode 获取） |
| 基金公司简介 / 公司规模 | `call_fund_company_info.py` | `compcode`（从 fund_info 的 CompanyId 获取） |
| 基金公司旗下基金列表 | `call_fund_company_funds.py` | `compcode` |
| 基金公司旗下基金经理 | `call_fund_company_managers.py` | `compcode` |
| 按名称/关键词搜索基金 | `search_fund.py` | `key` |

> 综合分析时，建议先调用 `call_fund_info.py` 获取基础档案（含 CompanyId 和 manager[].pcode），再按需并行调用其他脚本。

---

## API 列表

所有调用统一格式：`GET https://mcp.finance.sina.com.cn/api-call/<api_code>?参数`，Header 需要 `X-Auth-Token: $X_AUTH_TOKEN`。

### 1. 基金搜索 (`globalStockSearchSymbols`)

按名称/代码搜索基金，支持所有基金类型。

- **参数**：
  - `type`（必填）：`"21,202,203,204,205"` 覆盖全部基金类型
  - `key`（必填）：搜索关键词（基金名称、拼音、代码均可）
  - `format`（必填）：固定 `"text"`
  - `num`（必填）：固定 `"4"`
- **返回**：文本，每行一条，逗号分隔，第3位为code，第5位为名称，第9位为状态（1上市）

### 2. 基金档案 (`fund_info`)

获取基金基础信息，含管理人/托管人/经理列表/投资目标等。

- **参数**：`symbol`（必填，如 `004369`）
- **关键返回字段**：`jjqc`(全称) `jjjc`(简称) `clrq`(成立日) `glr`(管理人) `tgr`(托管人) `CompanyId`(公司代码) `manager[].pcode`(经理代码) `jjgm`(规模) `tzmb`(投资目标)

### 3. 基金累计回报 (`fund_cum_return`)

多时间段回报率及同类排名，覆盖近1日至成立以来。

- **参数**：`symbol`（必填）
- **关键返回字段**：`NAVGRL1W/1M/3M/6M/1Y/2Y/3Y/5Y`(回报率) `SIMILARRANKL*`(同类排名) `NAVGRT1Y`(今年以来) `NAVGRLIST`(成立以来)

### 4. 基金历史净值 (`fund_networth`)

逐日历史净值数据，适合绘制走势图。

- **参数**：`symbol`（必填）
- **关键返回字段**：`ENDDATE`(日期) `UNITNAV`(单位净值) `UNITACCNAV`(累计净值) `NAVGRTD`(日增长率) `REPAIRUNITNAV`(复权净值)

### 5. 基金核心指标 (`fund_core_metrics`)

风险分析三大指标：最大回撤、夏普比率、波动率，均含同类排名。

- **参数**：`symbol`（必填）
- **关键返回字段**：
  - `config[0].MAXRETRACEL1M/3M/6M/1Y/2Y/3Y/FOUND`（各期最大回撤）
  - `config[0].SHARP52W/24M/60M`（夏普比率）
  - `config[0].VOLATILITY52W/24M/60M`（波动率）
  - `maxretrace.lists[].value/rank_value`（最大回撤值+同类排名百分位）
  - `sharp.lists[].value/rank_value`（夏普值+同类排名百分位）
  - `volatility.lists[].value/rank_value`（波动率+同类排名百分位）

### 6. 基金重仓股 (`fund_heavy_stock`)

基金最新季报重仓股，含持仓市值/占净值比例/流通股比例。

- **参数**：`symbol`（必填）；`page`、`num`（分页，可选）
- **关键返回字段**：`data[].SKNAME`(股票名称) `HOLDMKTCAP`(持有市值) `NAVRTO`(占净值%) `ACCCIRCRTO`(占流通股%) `DIFFHOLDMKTCAP`(较上期变动)

### 7. 基金重仓债券 (`fund_heavy_bond`)

债券型/混合型基金的重仓债券明细。

- **参数**：`symbol`（必填）；`page`、`num`（可选）
- **关键返回字段**：`data[].SKNAME`(债券名称) `HOLDMKTCAP`(持有市值) `NAVRTO`(占净值%) `EXCHANGE`(交易所)

### 8. 基金重仓基金 (`fund_heavy_fund`)

FOF 基金的重仓基金持仓明细。

- **参数**：`symbol`（必填，FOF格式如 `FD005957`）；`page`、`num`（可选）
- **关键返回字段**：`data[].FUNDNAME`(基金名称) `HOLDMKTCAP`(持有市值) `NAVRTO`(占净值%) `DIFFHOLDMKTCAP`(较上期变动)

### 9. 基金行业配置 (`fund_industry_alloc`)

按申万行业分类的持仓分布。

- **参数**：`symbol`（必填）
- **关键返回字段**：`data[].INDUSTRYNAME`(行业) `ACCNETMKTCAP`(占净值%) `MKTCAP`(市值) `BEFOREDIFF`(较上期变动%)

### 10. 基金资产配置 (`fund_asset_alloc`)

大类资产配置比例（股票/债券/现金等）。

- **参数**：`symbol`（必填）
- **关键返回字段**：`data[].name`(资产类别) `worth_pro`(占净值%) `market_value`(市值) `item`(子类详情)

### 11. 基金经理详情 (`fund_manager_detail`)

基金经理个人背景、从业经历、平均回报。

- **参数**：`pscode`（必填，基金经理代码，从 fund_info 的 `manager[].pcode` 获取）
- **关键返回字段**：`PSNAME`(姓名) `DEGREE`(学历) `TOTYEARS`(从业年限) `KEEPERNAME`(任职公司) `REMARK`(简介) `ALLAVGYIELD`(平均回报)

### 12. 基金公司简介 (`fund_company_info`)

基金公司基础信息，含规模/成立时间/旗下基金数量。

- **参数**：`compcode`（必填，从 fund_info 的 `CompanyId` 获取）
- **关键返回字段**：`COMPNAME`(公司名) `REGION`(注册地) `FOUNDDATE`(成立时间) `FDSHARE`(管理规模) `FDNUMBER`(基金数量) `MANAGERNUM`(经理人数) `COMPINTRO`(简介)

### 13. 基金公司旗下基金列表 (`fund_company_funds`)

公司旗下全部基金，含近1年回报和规模。

- **参数**：`compcode`（必填）；`page`、`num`（可选）
- **关键返回字段**：`data[].FDSNAME`(简称) `NAVGRL1Y`(近1年回报%) `NAVGRTD`(日增长率) `SCALE`(规模亿元)

### 14. 基金公司旗下基金经理 (`fund_company_managers`)

公司旗下全部基金经理，含在职状态和任期回报。

- **参数**：`compcode`（必填）；`page`（必填）；`num`（必填）
- **关键返回字段**：`data[].MANAGERNAME`(姓名) `ISINCUMBENT`(是否现任) `TENUREYIELDYR`(任期年化回报) `CURFCOUNT`(当前管理基金数) `RENQI`(任期描述)

---

## 错误处理

- **401 Unauthorized**: `X_AUTH_TOKEN` 无效或已过期
- **403 Forbidden**: 当前 token 无权访问此 API
- **404 Not Found**: api_code 不存在
- **5xx**: 服务端错误，建议稍后重试
- **result.status.code != 0**: 业务错误，参考 result.status.msg
