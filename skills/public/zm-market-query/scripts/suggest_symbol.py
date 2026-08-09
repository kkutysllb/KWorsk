#!/usr/bin/env python3
"""通过 globalStockSearchSymbols 搜索金融标的 symbol，供用户确认后使用。

支持范围：
    股票（A股/港股/美股）、基金、ETF、指数、债券等多种金融标的。
    虽然接口名称含 "Stock"，但实际可搜索各类证券代码。

使用场景：
    当用户提供的标的信息不明确时（公司名、基金简称、指数名称、拼音等），
    先运行本脚本获取候选 symbol 列表，展示给用户确认，
    再将确认的 symbol 传入业务接口。

Usage:
    python3 suggest_symbol.py --keyword <关键词>
    python3 suggest_symbol.py --keyword 茅台
    python3 suggest_symbol.py --keyword 沪深300
    python3 suggest_symbol.py --keyword AAPL
    python3 suggest_symbol.py --keyword 华夏基金 --json   # 输出原始 JSON

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

SUGGEST_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockSearchSymbols"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def search_symbol(keyword: str, token: str) -> list:
    qs  = urllib.parse.urlencode({"type": "11,12,31", "key": keyword, "format": "text", "num": "4"})
    url = f"{SUGGEST_URL}?{qs}"
    req = urllib.request.Request(
        url,
        headers={"X-Auth-Token": token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)

    # 兼容多种响应结构
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("data", "list", "results", "items", "symbols"):
            if key in data and isinstance(data[key], list):
                return data[key]
    return []


def format_results(items: list) -> str:
    if not items:
        return "（未找到匹配结果）"
    lines = ["# 搜索结果（请与用户确认后再使用）"]
    for i, item in enumerate(items, 1):
        symbol = item.get("symbol") or item.get("code") or item.get("ticker") or ""
        name   = item.get("name") or item.get("short_name") or item.get("companyName") or ""
        market = item.get("market") or item.get("exchange") or item.get("market_name") or ""
        lines.append(f"{i:2d}.  {symbol:<15}  {name:<20}  {market}")
    return "\n".join(lines)


def main():
    token = get_token()
    parser = argparse.ArgumentParser(
        description="搜索金融标的 Symbol（调用 globalStockSearchSymbols，支持股票/基金/ETF/指数/债券等）"
    )
    parser.add_argument("--keyword", required=True, help="标的关键词（公司名、基金名、指数名、代码等）")
    parser.add_argument("--json",    action="store_true", help="输出原始 JSON")
    args = parser.parse_args()

    items = search_symbol(args.keyword, token)

    if args.json:
        print(json.dumps(items, ensure_ascii=False, indent=2))
    else:
        print(format_results(items))


if __name__ == "__main__":
    main()
