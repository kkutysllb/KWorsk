---
name: zm-market-index-quotes
description: >
  查询上证指数、沪深300、创业板指、恒生指数、纳斯达克指数等指数行情数据，
  支持涨跌幅、成交量等指标查询，返回相关指数数据结果。
  当用户询问指数数据、上证指数、沪深300、创业板指、恒生指数、纳斯达克指数、
  指数行情、指数涨跌幅等问题时，必须使用此技能。
---

# 指数行情查询

查询上证指数、沪深300、创业板指、恒生指数、纳斯达克指数等主要指数的实时行情数据，
支持涨跌幅、成交量、开收盘价等多维度指标。

## 触发条件

当用户询问以下内容时必须使用此 skill：

- 指数行情、指数涨跌幅、指数数据
- 上证指数、上证综指
- 沪深300
- 创业板指
- 深证成指
- 科创50
- 恒生指数、港股指数
- 纳斯达克指数、美股指数

## 常用指数代码速查

| 指数名称 | market | symbol |
| --- | --- | --- |
| 上证指数 | `cn` | `sh000001` |
| 沪深300 | `cn` | `sh000300` |
| 深证成指 | `cn` | `sz399001` |
| 创业板指 | `cn` | `sz399006` |
| 科创50 | `cn` | `sh000688` |
| 恒生指数 | `hk` | `HSI` |
| 纳斯达克指数 | `us` | `.IXIC` |
| 道琼斯指数 | `us` | `.DJI` |
| 标普500 | `us` | `.INX` |

## API 信息

| 项目 | 值 |
| --- | --- |
| API Code | `globalStockQuoteRealtime` |
| 调用地址 | `https://mcp.finance.sina.com.cn/api-call/globalStockQuoteRealtime` |
| HTTP 方法 | `GET` |
| 认证方式 | Header `X-Auth-Token: $X_AUTH_TOKEN` |

## 参数说明

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `market` | string | ✅ | 市场代码：`cn`=沪深、`hk`=港股、`us`=美股、`gi`=全球指数 |
| `symbol` | string | ✅ | 股票/指数代码，如 `sh000001`、`HSI` |

> 每次请求查询**单个**指数，查询多个指数需发起多次请求。

## 使用步骤

1. 根据用户询问的指数，从速查表选择对应的 `market` 和 `symbol`
2. 若用户未指定，默认查询 A 股三大指数：上证指数、沪深300、创业板指
3. 使用 Bash 工具执行 `scripts/call_api.py`（支持批量查询，内部循环多次请求）
4. 解析返回结果，向用户展示：指数名称、当前价格、涨跌额、涨跌幅(%)、成交量、成交额

## 调用示例

### 查询单个指数

```bash
python3 /root/.claude/skills/zm-market-index-quotes/scripts/call_api.py \
    --market cn --symbol sh000001
```

### 批量查询多个指数

```bash
python3 /root/.claude/skills/zm-market-index-quotes/scripts/call_api.py \
    --batch "cn:sh000001,cn:sh000300,cn:sz399006,hk:HSI,gi:IXIC"
```

### Python 内联调用（单个）

```python
import os, urllib.request, urllib.parse, json

token = os.environ.get("X_AUTH_TOKEN", "")
base  = "https://mcp.finance.sina.com.cn/api-call/globalStockQuoteRealtime"
url   = base + "?" + urllib.parse.urlencode({"market": "cn", "symbol": "sh000001"})

headers = {"Accept": "application/json"}
if token:
    headers["X-Auth-Token"] = token

req = urllib.request.Request(url, headers=headers, method="GET")
with urllib.request.urlopen(req, timeout=15) as resp:
    result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))
```

## 返回字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `symbol` | string | 指数代码 |
| `name` | string | 指数名称 |
| `price` | number | 当前价格/点位 |
| `preClose` | number | 昨收价 |
| `percent` | number | 涨跌幅（%） |
| `change` | number | 涨跌额 |
| `openPrice` | number | 今日开盘价 |
| `high` | number | 今日最高价 |
| `low` | number | 今日最低价 |
| `volume` | number | 成交量 |
| `amount` | number | 成交额 |
| `hqDate` | string | 行情日期 |
| `hqTime` | string | 行情时间 |

## 结果展示格式建议

```
📊 主要指数行情（HH:MM）

指数名称    当前点位   涨跌幅    涨跌额
上证指数    3,XXX.XX  +X.XX%   +XX.XX
沪深300     X,XXX.XX  +X.XX%   +XX.XX
创业板指    X,XXX.XX  -X.XX%   -XX.XX
恒生指数   XX,XXX.XX  -X.XX%  -XXX.XX
纳斯达克   XX,XXX.XX  +X.XX%   +XX.XX
```

## 错误处理

- **401 Unauthorized**: `X_AUTH_TOKEN` 无效或已过期，提示用户检查 token
- **403 Forbidden**: 当前 token 无权访问此 API
- **返回数据为空**: 可能为非交易时间，说明当前市场已休市
- **5xx**: 服务端错误，建议稍后重试
