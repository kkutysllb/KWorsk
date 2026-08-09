---
name: zm-finance-news-search
description: 财经新闻搜索引擎，支持关键词搜索财经资讯和快讯，以及按股票代码查询个股新闻。囊括官媒、主流财经媒体、垂直行业网站、知名上市/非上市公司官网等多类媒体，可帮助了解最新财经事件、政策动态、行业革新、企业业务进展。当用户需要搜索财经新闻、查询事件动态、了解政策/行业/企业资讯，或查看某只股票的相关新闻时使用此 skill。
---

# finance-news-search

财经领域资讯搜索引擎，支持自然语言关键词搜索，覆盖官媒、主流财经媒体、垂直行业网站、知名上市/非上市公司官网等多类媒体；同时支持按股票代码精准查询个股新闻。

## API 信息

| API | Code | 调用地址 | 适用场景 |
| --- | --- | --- | --- |
| 新闻搜索 | `newsSearch` | `https://mcp.finance.sina.com.cn/api-call/newsSearch` | 关键词搜索深度报道 |
| 快讯搜索 | `qNewsSearch` | `https://mcp.finance.sina.com.cn/api-call/qNewsSearch` | 关键词搜索实时快讯 |
| 个股新闻 | `stockNewsSearch` | `https://mcp.finance.sina.com.cn/api-call/stockNewsSearch` | 指定股票的相关新闻 |

HTTP 方法统一为 `GET`，所有参数通过 Query String 传递，认证方式：Header `X-Auth-Token: $X_AUTH_TOKEN`。

## 参数说明

### newsSearch / qNewsSearch（关键词搜索）

| 参数 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `keyword` | ✅ | string | 关键词，多个用英文逗号分隔，最多 10 个，每个最长 15 字符。示例：`"关税政策,贸易战"` |
| `page` | 否 | int | 页码，默认 1 |
| `num` | 否 | int | 每页条数，默认 10，最大 20 |

### stockNewsSearch（个股新闻）

| 参数 | 必填 | 类型 | 说明 |
| --- | --- | --- | --- |
| `market` | ✅ | string | 市场代码：`cn`（沪深）、`hk`（港股）、`us`（美股） |
| `symbol` | ✅ | string | 股票代码，沪深需带前缀：`sh600519`、`sz000002`；港股/美股示例：`00700`、`AAPL` |
| `page` | 否 | string | 页码，默认 `"1"`，最大 `"100"` |
| `num` | 否 | string | 每页条数，默认 `"10"`，最大 `"20"` |

## 返回格式

**newsSearch / qNewsSearch：**
```json
{
  "result": {
    "status": { "code": 0, "msg": "成功" },
    "data": [{ "title": "新闻标题", "content": "内容摘要" }],
    "extra": { "tips": "提示", "total_num": 42 }
  }
}
```

**stockNewsSearch：**
```json
{
  "result": {
    "status": { "code": 0, "msg": "成功" },
    "data": [{ "title": "新闻标题", "url": "PC链接", "wapurl": "移动端链接" }]
  }
}
```

## 使用方式

### 何时用哪个 API

| 用户意图 | 使用 API |
| --- | --- |
| "最新财经新闻"、"政策动态"、"行业进展" | `newsSearch` |
| "今天有什么快讯"、"盘中消息" | `qNewsSearch` |
| "茅台最近的新闻"、"查一下苹果公司新闻" | `stockNewsSearch` |

用户明确提到某只股票/公司名（且为上市公司）时，优先使用 `stockNewsSearch`。若对 symbol 不确定，先用 `globalStockSearchSymbols` 接口搜索确认。

**操作步骤：**
1. 确认环境变量 `X_AUTH_TOKEN` 已设置
2. 判断用户意图，选择对应脚本
3. 解析并向用户展示标题和内容摘要，给出总条数

## 调用示例

```bash
# 关键词搜索新闻
python3 scripts/call_api.py --keyword "新能源汽车,补贴政策" --num 10

# 关键词搜索快讯
python3 scripts/call_qnews_search.py --keyword "美联储降息" --num 5

# 个股新闻 —— 贵州茅台（A股）
python3 scripts/call_stock_news_search.py --market cn --symbol sh600519 --num 10

# 个股新闻 —— 腾讯（港股）
python3 scripts/call_stock_news_search.py --market hk --symbol 00700 --num 10

# 个股新闻 —— 苹果（美股）
python3 scripts/call_stock_news_search.py --market us --symbol AAPL --num 10
```

## 错误处理

- **401 Unauthorized**: `X_AUTH_TOKEN` 无效或已过期，提示用户重新获取 token
- **403 Forbidden**: 当前 token 无权访问此 API
- **404 Not Found**: api_code 不存在，检查拼写
- **5xx**: 服务端错误，建议稍后重试
