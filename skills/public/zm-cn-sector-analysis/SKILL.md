---
name: zm-cn-sector-analysis
description: 查询京沪深行业资金、行情、板块排名、行业成分股，以及查询某只股票所属行业的整体表现。支持自然语言问句输入，返回相关行业数据结果。当用户询问行业数据、行业行情、行业成分股、板块资金流向、板块排名、某股票属于哪个行业及该行业表现等问题时，必须使用此技能。
required-secrets:
  - X_AUTH_TOKEN
---

# cn-sector-analysis：京沪深行业板块分析

查询 A 股行业板块的行情、资金流向、板块排名及成分股数据，覆盖申万行业分类（1/2/3 级）、概念板块、地域板块。

## 涉及 API

| API Code | 功能 | 调用脚本 |
| --- | --- | --- |
| `cnVirtualSectorRanking` | 行业/板块行情列表 + 资金流向 + 板块排名 | `scripts/call_api.py` |
| `cnSectorComponentsRanking` | 行业/指数成分股排行 | `scripts/call_sector_components.py` |
| `cnMarketStrongSectors` | A 股强势板块列表 | `scripts/call_strong_sectors.py` |
| `cnCompanyBasicInfo` | 查询个股所属行业分类 | `scripts/call_company_info.py` |

**认证方式**：所有接口均需 Header `X-Auth-Token: $X_AUTH_TOKEN`

---

## 使用方式

1. 确认环境变量 `X_AUTH_TOKEN` 已设置
2. 根据用户问题判断调用哪个接口：
   - 查询**行业行情/资金流向/板块排名** → `cnVirtualSectorRanking`（`scripts/call_api.py`）
   - 查询**某行业/板块/指数的成分股** → `cnSectorComponentsRanking`（`scripts/call_sector_components.py`，需要 `node` 参数即板块代码）
   - 查询**今日强势板块** → `cnMarketStrongSectors`（`scripts/call_strong_sectors.py`）
   - 查询**某只股票所属行业及该行业表现** → 先用 `cnCompanyBasicInfo`（`scripts/call_company_info.py`）查公司行业分类，再用 `cnVirtualSectorRanking` 匹配对应行业
3. 若用户提供板块名称（如"半导体"、"新能源"），先通过 `cnVirtualSectorRanking` 返回的 `index_code` 确认板块代码，再查成分股
4. 解析并向用户展示结果

---

## API 1：cnVirtualSectorRanking（板块行情 + 资金流向 + 排名）

**调用地址**：`https://mcp.finance.sina.com.cn/api-call/cnVirtualSectorRanking`（GET）

### 参数说明

| 参数名 | 必填 | 示例 | 常用取值 | 说明 |
| --- | --- | --- | --- | --- |
| `index_type` | 否 | `hy` | 空=全部板块、`hy1`=申万1级行业、`hy`=申万2级行业、`hy3`=申万3级行业、`gn`=概念、`dy`=地域 | 默认返回全部类型 |
| `sort` | 否 | `percent` | `percent`=涨跌幅、`rp_net`=主力净流入、`bszj1`=1日北向净买入、`bszj5`=5日北向净买入、`bszj20`=20日北向净买入、`totalAmount`=成交额、`totalVolume`=成交量、`turnOver`=换手率、`changes_5d`=5日涨幅、`changes_20d`=20日涨幅、`yearPercent`=今年以来涨幅、`up_num`=上涨家数 | 默认：涨跌幅倒序 |
| `asc` | 否 | `0` | `0`=倒序、`1`=正序 | 默认倒序 |
| `page` | 否 | `1` | 正整数 | 默认第1页 |
| `num` | 否 | `20` | 1-30 | 每页最多30条 |

### 核心返回字段

| 字段 | 说明 |
| --- | --- |
| `index_name` | 板块名称 |
| `index_code` | 板块代码（可用作 cnSectorComponentsRanking 的 node 参数） |
| `node_code` | 财汇板块代码 |
| `percent` | 涨跌幅% |
| `rp_net` | 今日主力净流入 |
| `rp_net_5d` / `rp_net_20d` | 5/20日主力净流入 |
| `bszj1` / `bszj5` / `bszj20` | 1/5/20日北向净买入 |
| `up_num` / `down_num` | 上涨/下跌家数 |
| `totalAmount` | 成交额 |
| `turnOver` | 换手率% |
| `lz_name` / `lz_percent` | 领涨股名称/涨幅 |

### 调用示例

```bash
# 申万2级行业，按主力净流入排名前20
python3 scripts/call_api.py --index_type hy --sort rp_net --num 20

# 全部板块，按今日涨跌幅排名
python3 scripts/call_api.py --sort percent

# 1日北向净买入最多的申万1级行业
python3 scripts/call_api.py --index_type hy1 --sort bszj1
```

---

## API 2：cnSectorComponentsRanking（行业/指数成分股）

**调用地址**：`https://mcp.finance.sina.com.cn/api-call/cnSectorComponentsRanking`（GET）

### 参数说明

| 参数名 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `node` | **是** | `sh000001` | 板块/指数代码。申万行业板块代码来自 `cnVirtualSectorRanking` 的 `index_code` 字段；也可用指数代码如 `sh000001`（上证指数） |
| `sort` | 否 | `percent` | 排序字段，同 cnVirtualSectorRanking 的 sort 参数 |
| `asc` | 否 | `0` | 0=倒序（默认），1=正序 |
| `page` | 否 | `1` | 页码 |
| `num` | 否 | `50` | 每页数量 |
| `ret` | 否 | `price,percent,rp_net` | 自定义返回字段（英文逗号分隔），不填则返回全部 |
| `hnew` | 否 | `1` | 是否含新股，1=含（默认），0=不含 |

### 调用示例

```bash
# 查询某行业成分股（先从 cnVirtualSectorRanking 获取 index_code）
python3 scripts/call_sector_components.py --node "index_code" --sort percent

# 查询上证50成分股，按总市值排序
python3 scripts/call_sector_components.py --node sh000016 --sort totalShare --num 50
```

---

## API 3：cnMarketStrongSectors（强势板块）

**调用地址**：`https://mcp.finance.sina.com.cn/api-call/cnMarketStrongSectors`（GET）

### 参数说明

| 参数名 | 必填 | 常用取值 | 说明 |
| --- | --- | --- | --- |
| `bk` | 否 | `gn`=概念板块（默认）、`hy`=行业板块、`dy`=地域板块 | 板块类型 |
| `type` | 否 | `all`=全市场（默认）、`ck`=科创板+创业板、`other`=其他 | 市场范围 |
| `isNotSt` | 否 | `1`=排除ST（默认）、`0`=包含ST | 是否过滤ST |

### 核心返回字段

| 字段 | 说明 |
| --- | --- |
| `name` | 板块名称 |
| `symbol` | 板块代码 |
| `percent` | 板块涨跌幅 |
| `zt` | 涨停家数 |
| `lb` | 连板家数 |
| `ztSymbol` | 涨停股票列表（含名称、价格、首板等信息） |

### 调用示例

```bash
# 今日强势行业板块
python3 scripts/call_strong_sectors.py --bk hy

# 全市场强势概念板块（含ST）
python3 scripts/call_strong_sectors.py --bk gn --isNotSt 0
```

---

## API 4：cnCompanyBasicInfo（个股所属行业查询）

**调用地址**：`https://mcp.finance.sina.com.cn/api-call/cnCompanyBasicInfo`（GET）

用于在"用户给出股票代码/名称，要查该股所属行业表现"场景中，获取公司的行业分类信息。

### 参数说明

| 参数名 | 必填 | 示例 | 说明 |
| --- | --- | --- | --- |
| `symbol` | **是** | `sh600519` | 带市场前缀的股票代码（sh=上交所，sz=深交所） |

### 关键返回字段（行业相关）

返回数据包含行业分类字段（如申万行业名称），用于后续在 `cnVirtualSectorRanking` 结果中匹配对应 `index_name`，获取该行业的完整行情和资金数据。

### 调用示例

```bash
# 查询贵州茅台所属行业
python3 scripts/call_company_info.py --symbol sh600519

# 查询比亚迪所属行业
python3 scripts/call_company_info.py --symbol sz002594
```

---

## 常见问题处理

**Q：用户说"帮我看看半导体行业的资金流向"**
1. 调用 `cnVirtualSectorRanking?index_type=hy&sort=rp_net` 获取行业列表，找到"半导体"行业条目
2. 从结果中提取 `rp_net`、`bszj1`、`bszj5` 等资金字段展示给用户

**Q：用户说"帮我看看半导体板块有哪些成分股"**
1. 先调用 `cnVirtualSectorRanking?index_type=hy` 搜索"半导体"找到对应 `index_code`
2. 再调用 `cnSectorComponentsRanking?node=<index_code>` 获取成分股列表

**Q：用户问"今天哪些板块最强"**
- 直接调用 `cnMarketStrongSectors?bk=hy` 获取强势行业板块

**Q：用户说"帮我看看宁德时代所在行业今天表现怎么样"**
1. 若用户只提供股票名称，先用 `globalStockSearchSymbols` 搜索确认 symbol（如 `sz300750`）
2. 调用 `cnCompanyBasicInfo?symbol=sz300750` 获取公司行业分类字段（申万行业名称）
3. 调用 `cnVirtualSectorRanking?index_type=hy` 获取全部申万2级行业列表
4. 在结果中按 `index_name` 模糊匹配步骤2中的行业名称，提取对应行业的 `percent`、`rp_net`、`up_num` 等数据展示给用户

## 错误处理

- **401 Unauthorized**：`X_AUTH_TOKEN` 无效或过期，提示用户重新获取 token
- **403 Forbidden**：当前 token 无权访问此 API
- **404 Not Found**：`node` 参数板块代码不存在，需先通过 `cnVirtualSectorRanking` 确认代码
- **5xx**：服务端错误，建议稍后重试
