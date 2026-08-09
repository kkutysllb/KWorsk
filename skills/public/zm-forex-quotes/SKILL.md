---
name: zm-forex-quotes
description: 查询实时外汇汇率行情，支持单货币对查询和批量多货币对查询。返回买入价、卖出价、涨跌幅、52周高低价等核心数据，适用于汇率行情查询、carry策略分析、货币对筛选等场景。当用户询问外汇汇率、货币对行情、汇率涨跌、买入价卖出价等问题时使用此 skill。
required-secrets:
  - X_AUTH_TOKEN
---

# 外汇实时汇率行情

查询指定货币对的实时汇率行情，支持单货币对精确查询和批量多货币对查询。

## API 信息

### 1. 单货币对查询 — `forexQuoteLatest`

| 项目 | 值 |
| --- | --- |
| API Code | `forexQuoteLatest` |
| 调用地址 | `https://mcp.finance.sina.com.cn/api-call/forexQuoteLatest` |
| HTTP 方法 | `GET`（参数通过 Query String 传递） |
| 认证方式 | Header `X-Auth-Token: $X_AUTH_TOKEN` |

**参数说明：**

| 参数名 | 必填 | 格式 | 示例 | 描述 |
| --- | --- | --- | --- | --- |
| symbol | 是 | 全大写字符串 | `USDCNY` | 货币对代码，如 `EURUSD`、`GBPUSD`、`USDJPY` 等 |

**返回字段：**

| 字段 | 类型 | 描述 |
| --- | --- | --- |
| updateTime | string | 数据更新时间 |
| symbol | string | 货币对代码 |
| tickTime | string | 报价时间 |
| askPrice | number | 卖出价（卖出基础货币的价格） |
| bidPrice | number | 买入价（买入基础货币的价格） |
| price | number | 当前现价 |
| priceAdjustFactor | number | 价格调整因子 |
| open | number | 开盘价 |
| high | number | 最高价 |
| low | number | 最低价 |
| close | number | 收盘价 |
| pctChg | number | 涨跌幅 |
| chg | number | 涨跌额 |
| yestTradeClose | number | 昨日收盘价 |
| high52Week | number | 52周最高价 |
| low52Week | number | 52周最低价 |

### 2. 批量货币对查询 — `forexQuotesBatch`

| 项目 | 值 |
| --- | --- |
| API Code | `forexQuotesBatch` |
| 调用地址 | `https://mcp.finance.sina.com.cn/api-call/forexQuotesBatch` |
| HTTP 方法 | `GET`（参数通过 Query String 传递） |
| 认证方式 | Header `X-Auth-Token: $X_AUTH_TOKEN` |

**参数说明：**

| 参数名 | 必填 | 格式 | 示例 | 描述 |
| --- | --- | --- | --- | --- |
| from | 是 | ISO 4217 三字母代码 | `USD` | 基础货币代码 |
| to | 是 | 逗号分隔的货币代码 | `CNY,JPY,EUR` | 目标货币代码列表 |

**返回字段：** 与单货币对查询一致，返回数组，每个元素对应一个货币对。

## 使用方式

1. 确认环境变量 `X_AUTH_TOKEN` 已设置（调用 API 时必须）
2. 根据用户请求选择合适的查询方式：
   - **查询单个货币对**：使用 `scripts/call_api.py`，传入 `--symbol` 参数
   - **批量查询多个货币对**：使用 `scripts/call_forexQuotesBatch.py`，传入 `--from` 和 `--to` 参数
3. 解析并向用户展示返回结果

若用户提供的标的信息不明确（如仅说"美元汇率"、"欧元对日元"等），先调用 `globalStockSearchSymbols` 搜索并向用户确认货币对代码，再调用本接口。该接口支持股票、基金、ETF、指数、债券等多种金融标的搜索。

## 调用示例

### 单货币对查询

```bash
# 查询 USDCNY 实时汇率
python3 scripts/call_api.py --symbol USDCNY

# 查询 EURUSD 实时汇率
python3 scripts/call_api.py --symbol EURUSD
```

### 批量查询

```bash
# 查询 USD 兑 CNY、JPY、EUR 的汇率
python3 scripts/call_forexQuotesBatch.py --from USD --to CNY,JPY,EUR

# 查询 EUR 兑 USD、GBP 的汇率
python3 scripts/call_forexQuotesBatch.py --from EUR --to USD,GBP
```

### 直接 curl 调用

```bash
# 单货币对
curl -s -H "X-Auth-Token: $X_AUTH_TOKEN" \
  "https://mcp.finance.sina.com.cn/api-call/forexQuoteLatest?symbol=USDCNY"

# 批量查询
curl -s -H "X-Auth-Token: $X_AUTH_TOKEN" \
  "https://mcp.finance.sina.com.cn/api-call/forexQuotesBatch?from=USD&to=CNY,JPY"
```

## 常用货币对参考

| 货币对 | 含义 |
| --- | --- |
| USDCNY | 美元/人民币 |
| EURUSD | 欧元/美元 |
| GBPUSD | 英镑/美元 |
| USDJPY | 美元/日元 |
| AUDUSD | 澳元/美元 |
| USDCAD | 美元/加元 |
| USDCHF | 美元/瑞郎 |
| NZDUSD | 新西兰元/美元 |
| EURGBP | 欧元/英镑 |
| EURJPY | 欧元/日元 |

## 错误处理

- **401 Unauthorized**: `X_AUTH_TOKEN` 无效或已过期，提示用户重新获取 token
- **403 Forbidden**: 当前 token 无权访问此 API
- **404 Not Found**: api_code 不存在，检查拼写
- **5xx**: 服务端错误，建议稍后重试或联系管理员
