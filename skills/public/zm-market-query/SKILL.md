---
name: zm-market-query
description: 支持自然语言查询行情数据，覆盖A港美、期货等多种资产，含实时行情、历史行情、资金流向、财务报表、公司信息、估值、板块等。适用于投资研究、交易复盘、市场监控、行业分析等场景。
---

# 市场行情查询（Market Query）

支持自然语言查询行情数据，覆盖A股、港股、美股、期货等多种资产类型，包含实时行情、历史K线、资金流向、财务报表、公司基础信息（基本资料、股东股本、主营构成）、估值数据等，可用于投资研究、交易复盘、市场监控、行业分析、信用研究、财报审计、资产配置等场景。

## Symbol 确认（必读）

**调用含 symbol 参数的接口前，必须通过 `scripts/suggest_symbol.py` 确认 symbol。**

`globalStockSearchSymbols` 接口支持搜索多种金融标的（股票、基金、ETF、指数、债券等）。
当用户提供的标的信息不够精确时（如只说公司中文名、简称、基金名称、指数名称，
或同名多市场的情况），**不得猜测或假设 symbol**，必须严格执行以下流程：

1. 运行 `scripts/suggest_symbol.py --keyword "<用户描述>"` 获取候选列表
2. 将候选列表完整展示给用户，请用户明确选择
3. 用户确认后，使用选定的 symbol 调用本接口

```bash
# 示例：搜索 symbol（支持股票、基金、ETF、指数等）
python3 scripts/suggest_symbol.py --keyword "茅台"
python3 scripts/suggest_symbol.py --keyword "沪深300"
python3 scripts/suggest_symbol.py --keyword "AAPL"
python3 scripts/suggest_symbol.py --keyword "华夏基金"
```

> 若用户已明确给出完整 symbol（如 `sh600519`、`510300.SH`），可跳过搜索直接调用。

## API 信息

| 项目 | 值 |
| --- | --- |
| 调用基础地址 | `https://mcp.finance.sina.com.cn/api-call/<api_code>` |
| HTTP 方法 | `GET`（所有 api-call 统一为 GET，参数通过 Query String 传递） |
| 认证方式 | Header `X-Auth-Token: $X_AUTH_TOKEN` |

---

## 一、实时行情

### globalStockQuoteRealtime — 股票实时行情（A港美）

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `market` | string | ✅ | 市场代码: `cn`(沪深)/`hk`(港股)/`us`(美股)/`gi`(全球指数) |
| `symbol` | string | ✅ | 股票代码，如 `sh688001`/`00700`/`AAPL` |

```bash
python3 scripts/call_globalStockQuoteRealtime.py --market cn --symbol sh688001
python3 scripts/call_globalStockQuoteRealtime.py --market hk --symbol 00700
python3 scripts/call_globalStockQuoteRealtime.py --market us --symbol AAPL
```

---

## 二、历史行情

### globalStockKlineDaily — 全市场股票日K线

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `market` | string | ✅ | 市场代码: `cn`/`hk`/`us`/`gi` |
| `symbol` | string | ✅ | 股票代码 |
| `fq_type` | string | ❌ | 复权类型: `qfq`(前复权)/`hfq`(后复权)，空=不复权 |
| `compare` | string | ❌ | 对比: `le`(小于等于)/`ge`(大于等于) |
| `in_date` | string | ❌ | 目标日期，YYYY-MM-DD |
| `num` | string | ❌ | 查询数量，正整数，默认1 |

```bash
python3 scripts/call_globalStockKlineDaily.py --market cn --symbol sz000002 --fq_type qfq --num 30
python3 scripts/call_globalStockKlineDaily.py --market hk --symbol 00700 --num 60
```

### cnStockKLine — A股股票分钟K线

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sh600519` |
| `scale` | string | ✅ | 分钟维度: `1`/`3`/`5`/`10`/`15`/`30`/`60` |
| `datalen` | string | ❌ | 数据长度，默认100 |

```bash
python3 scripts/call_cnStockKLine.py --symbol sh600519 --scale 5 --datalen 100
```

---

## 三、公司信息

### cnCompanyBasicInfo — A股公司基础信息

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sh688111` |

```bash
python3 scripts/call_cnCompanyBasicInfo.py --symbol sh688111
```

### cnCompanyCapitalHistory — A股公司股本变动

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `PaperCode` | string | ✅ | 不带前缀的A股代码，如 `601127` |

```bash
python3 scripts/call_cnCompanyCapitalHistory.py --PaperCode 601127
```

### cnCompanyShareholderHistory — A股公司股东人数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `Code` | string | ✅ | 不带前缀的A股代码，如 `601127` |
| `Type` | string | ✅ | `amount`(股东总数)/`average`(平均持股数) |

```bash
python3 scripts/call_cnCompanyShareholderHistory.py --Code 601127 --Type amount
```

### cnCompanyManagerInfo — A股公司高管详情

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sz000001` |

```bash
python3 scripts/call_cnCompanyManagerInfo.py --symbol sz000001
```

### usCompanyManagerInfo — 美国市场公司高管

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 美股代码，如 `aapl` |

```bash
python3 scripts/call_usCompanyManagerInfo.py --symbol aapl
```

### globalStockMajorEvents — 全市场公司重大事项

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbols` | string | ✅ | 股票代码，如 `600000` |
| `market` | string | ✅ | `0`(沪深)/`1`(港股)/`2`(美股) |
| `pageSize` | string | ✅ | 返回数量，正整数 |

```bash
python3 scripts/call_globalStockMajorEvents.py --symbols 600000 --market 0 --pageSize 10
```

---

## 四、财务报表

### cnFinanceReportsFull — A股公司财务指标

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `paperCode` | string | ✅ | 股票代码，如 `sz000002` |
| `source` | string | ✅ | 数据来源: `lrb`(利润表)/`fzb`(负债表)/`llb`(流量表)/`gjzb`(关键指标) |
| `rDate` | string | ❌ | 财报日期，YYYYMMDD格式 |

```bash
python3 scripts/call_cnFinanceReportsFull.py --paperCode sz000002 --source gjzb --rDate 20231231
```

### cnFinanceReportDateList — A股公司财报日期列表

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `paperCode` | string | ✅ | 股票代码，如 `sh600519` |

```bash
python3 scripts/call_cnFinanceReportDateList.py --paperCode sh600519
```

### cnFinanceRevenueComposition — A股公司主营构成

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `paperCode` | string | ✅ | 股票代码，如 `sz000002` |
| `rDate` | string | ❌ | 财报日期，YYYYMMDD格式 |

```bash
python3 scripts/call_cnFinanceRevenueComposition.py --paperCode sz000002
```

### cnFinanceGrReportDateList — A股公司主营构成报告日期列表

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `paperCode` | string | ✅ | 股票代码，如 `sh688387` |

```bash
python3 scripts/call_cnFinanceGrReportDateList.py --paperCode sh688387
```

### hkFinanceReportsByIndex — 港股财务指标

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 港股代码，如 `00700` |
| `source` | string | ✅ | `lrb`(利润表)/`fzb`(负债表)/`llb`(流量表)/`gjzb`(关键指标) |
| `field` | string | ✅ | 指标代码，同source |
| `type` | string | ✅ | `0`(全部)/`1`(一季报)/`2`(半年报)/`3`(三季报)/`4`(年报) |
| `num` | string | ✅ | 返回数量，正整数 |
| `currencyType` | string | ❌ | `1`(原始)/`2`(港币)/`3`(人民币)/`4`(美元)，默认2 |

```bash
python3 scripts/call_hkFinanceReportsByIndex.py --symbol 00700 --source lrb --field lrb --type 0 --num 5
```

---

## 五、估值数据

### cnStockValuationDetail — A股公司估值数据

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sz000002` |
| `rank` | string | ✅ | 时间跨度: `y1`/`y3`/`y5`/`y10`/`all` |
| `type` | string | ✅ | 估值指标: `syl`(市盈率TTM)/`sjl`(市净率)/`sxl`(市现率)/`gxl`(股息率)/`zsz`(总市值) |

```bash
python3 scripts/call_cnStockValuationDetail.py --symbol sz000002 --rank y1 --type syl
```

---

## 六、资金流向

### cnStockTradingMarginList — A股股票融资融券

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sz000002` |
| `page` | string | ❌ | 页码 |
| `num` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_cnStockTradingMarginList.py --symbol sz000002
```

### cnTradingBlockList — A股大宗交易

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 股票代码，如 `sh601127` |
| `p` | string | ❌ | 页码 |
| `num` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_cnTradingBlockList.py --symbol sh601127
```

### hkTradingMainFundsHistory — 港股主力资金历史

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 港股代码，如 `00700` |
| `days` | string | ❌ | 天数，默认60 |

```bash
python3 scripts/call_hkTradingMainFundsHistory.py --symbol 00700 --days 60
```

### usTradingFundFlow1Day — 美股今日资金趋势

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 美股代码，如 `aapl` |

```bash
python3 scripts/call_usTradingFundFlow1Day.py --symbol aapl
```

### usTradingFundFlow5Days — 美股5日累计净流入

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 美股代码，如 `aapl` |

```bash
python3 scripts/call_usTradingFundFlow5Days.py --symbol aapl
```

### usTradingFundFlow60Days — 美股主力资金历史

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `symbol` | string | ✅ | 美股代码，如 `aapl` |
| `days` | string | ❌ | 天数，默认60 |

```bash
python3 scripts/call_usTradingFundFlow60Days.py --symbol aapl --days 60
```

### cnStockConnectHoldings — A股沪深港通

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | ✅ | `hk`(港股通)/`sz`(深股通)/`sh`(沪股通) |
| `sort` | string | ✅ | 排序字段: `hold_ratio`/`percent`等 |
| `asc` | string | ✅ | `0`(从大到小)/`1`(从小到大) |
| `page` | string | ❌ | 页码 |
| `num` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_cnStockConnectHoldings.py --type hk --sort hold_ratio --asc 0
```

---

## 七、板块行情

### cnVirtualSectorRanking — A股虚拟板块列表

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `bk` | string | ❌ | 板块类型: `hy`(行业)/`gn`(概念)/`dy`(地域) |
| `sort` | string | ❌ | 排序字段: `percent`/`volume`/`turnover` |
| `asc` | string | ❌ | `0`(倒序)/`1`(正序) |

```bash
python3 scripts/call_cnVirtualSectorRanking.py --bk hy --sort percent --asc 0
```

### cnSectorComponentsRanking — A股指数和行业板块成分股

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `node` | string | ✅ | 指数/板块symbol，如 `sh000001`(上证指数) |
| `ret` | string | ❌ | 自定义返回字段，逗号分隔 |
| `sort` | string | ❌ | 排序字段，默认 `percent` |
| `asc` | string | ❌ | `0`(倒序)/`1`(正序) |
| `page` | string | ❌ | 页码 |
| `num` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_cnSectorComponentsRanking.py --node sh000001
```

### cnMarketStrongSectors — A股强势板块列表

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | ❌ | 市场类型: `all`/`cyb`等 |
| `isNotSt` | string | ❌ | `1`(不含ST)/`0`(含) |
| `bk` | string | ❌ | `gn`(概念)/`hy`(行业)/`dy`(地域) |

```bash
python3 scripts/call_cnMarketStrongSectors.py --type all --bk gn
```

### hkSectorQuotesList — 港股板块行情列表

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | ✅ | `hk_plate_rise`(领涨)/`hk_plate_fall`(领跌)/`AHG`/`ggt`/`rmbk` |

```bash
python3 scripts/call_hkSectorQuotesList.py --type hk_plate_rise
```

### usSectorRanking — 美股板块列表

无参数。

```bash
python3 scripts/call_usSectorRanking.py
```

---

## 八、市场热度

### cnMarketUpdownDistribution — A股全市场涨跌分布统计

无参数。

```bash
python3 scripts/call_cnMarketUpdownDistribution.py
```

### cnMarketLimitUpPool — A股市场涨停池

无参数。

```bash
python3 scripts/call_cnMarketLimitUpPool.py
```

### cnStockLianBC — A股聚焦连板个股

无参数。

```bash
python3 scripts/call_cnStockLianBC.py
```

### hkStockHotBoard — 港股热度榜

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `pageIndex` | string | ❌ | 页码 |
| `pageSize` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_hkStockHotBoard.py
```

### hkStockSpecialRanking — 港股特色榜单

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `node` | string | ✅ | `gqg_hk`(国企股)/`lch_hk`(蓝筹股)/`hch_hk`(红筹股) |
| `sort` | string | ❌ | 排序字段 |
| `asc` | string | ❌ | `0`(倒序)/`1`(正序) |
| `page` | string | ❌ | 页码 |
| `num` | string | ❌ | 每页数量 |

```bash
python3 scripts/call_hkStockSpecialRanking.py --node gqg_hk --sort price --asc 0
```

---

## 九、期货数据

### futureCommodityList — 国内商品期货

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | ✅ | `dce`(大商所)/`shfe`(上期所)/`czce`(郑商所)/`gfex`(广期所) |

```bash
python3 scripts/call_futureCommodityList.py --type dce
```

### futureFinancialList — 金融期货

无参数。

```bash
python3 scripts/call_futureFinancialList.py
```

### futureGoldList — 黄金综合期货

无参数。

```bash
python3 scripts/call_futureGoldList.py
```

---

## 十、Symbol 搜索

### globalStockSearchSymbols — 全市场股票代码搜索

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `type` | string | ✅ | 市场类型: `11`(A股)/`12`(B股)/`31`(港股)等，逗号分隔 |
| `key` | string | ✅ | 搜索关键词 |
| `format` | string | ✅ | 固定 `text` |
| `num` | string | ✅ | 固定 `4` |

```bash
python3 scripts/call_globalStockSearchSymbols.py --type 11 --key 茅台
python3 scripts/suggest_symbol.py --keyword 茅台
```

---

## 使用方式

1. 确认环境变量 `X_AUTH_TOKEN` 已设置（调用 API 时必须）
2. 若 symbol 不明确，先运行 `scripts/suggest_symbol.py --keyword <关键词>` 搜索金融标的（支持股票/基金/ETF/指数/债券等），将候选列表展示给用户确认后再继续
3. 根据用户需求选择对应脚本发起调用（统一 GET 请求）
4. 解析并向用户展示返回结果

## 错误处理

- **401 Unauthorized**: `X_AUTH_TOKEN` 无效或已过期，提示用户重新获取 token
- **403 Forbidden**: 当前 token 无权访问此 API
- **404 Not Found**: api_code 不存在，检查拼写
- **5xx**: 服务端错误，建议稍后重试或联系管理员
