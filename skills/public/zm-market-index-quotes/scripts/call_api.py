#!/usr/bin/env python3
"""查询主要指数实时行情

Usage:
    # 查询单个指数
    python3 call_api.py --market cn --symbol sh000001

    # 批量查询（格式：market:symbol，逗号分隔）
    python3 call_api.py --batch "cn:sh000001,cn:sh000300,cn:sz399006,hk:HSI,gi:IXIC"

Environment:
    X_AUTH_TOKEN  - 认证 token（可选，未设置时仍尝试请求）
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockQuoteRealtime"

DEFAULT_BATCH = "cn:sh000001,cn:sh000300,cn:sz399006,hk:HSI,us:.IXIC"

INDEX_NAMES = {
    "sh000001": "上证指数",
    "sh000300": "沪深300",
    "sz399001": "深证成指",
    "sz399006": "创业板指",
    "sh000688": "科创50",
    "HSI":      "恒生指数",
    "IXIC":     "纳斯达克",
    "DJI":      "道琼斯",
    "SPX":      "标普500",
}


def call_api(market: str, symbol: str) -> dict:
    token = os.environ.get("X_AUTH_TOKEN", "")
    url = BASE_URL + "?" + urllib.parse.urlencode({"market": market, "symbol": symbol})

    headers = {"Accept": "application/json"}
    if token:
        headers["X-Auth-Token"] = token

    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code} [{market}:{symbol}]: {body}", file=sys.stderr)
        return {}
    except urllib.error.URLError as e:
        print(f"网络错误 [{market}:{symbol}]: {e.reason}", file=sys.stderr)
        return {}


def main():
    parser = argparse.ArgumentParser(description="查询主要指数实时行情")
    parser.add_argument("--market", help="市场代码：cn/hk/us/gi")
    parser.add_argument("--symbol", help="指数代码，如 sh000001、HSI")
    parser.add_argument(
        "--batch",
        default=DEFAULT_BATCH,
        help='批量查询，格式 "market:symbol,..."',
    )
    args = parser.parse_args()

    if args.market and args.symbol:
        result = call_api(args.market, args.symbol)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    # 批量模式
    results = []
    for item in args.batch.split(","):
        item = item.strip()
        if ":" not in item:
            print(f"格式错误，跳过: {item}", file=sys.stderr)
            continue
        market, symbol = item.split(":", 1)
        result = call_api(market.strip(), symbol.strip())
        if result:
            results.append(result)

    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
