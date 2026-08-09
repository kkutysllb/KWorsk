#!/usr/bin/env python3
"""调用 Finance Hub API: stockNewsSearch（个股新闻搜索）

查询指定股票的相关新闻，支持沪深、港股、美股。
当用户明确要查某只股票的新闻时使用此脚本。

Usage:
    python3 call_stock_news_search.py --market cn --symbol sh600519 [--page 1] [--num 10]
    python3 call_stock_news_search.py --market hk --symbol 00700
    python3 call_stock_news_search.py --market us --symbol AAPL

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/stockNewsSearch"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="查询个股新闻（stockNewsSearch API）")
    parser.add_argument("--market", required=True, choices=["cn", "hk", "us"],
                        help="市场代码：cn=沪深，hk=港股，us=美股")
    parser.add_argument("--symbol", required=True,
                        help="股票代码。沪深需带前缀，如 sh600519 / sz000002；港股如 00700；美股如 AAPL")
    parser.add_argument("--page", default="1",
                        help="页码，默认 1，最大 100")
    parser.add_argument("--num", default="10",
                        help="每页条数，默认 10，最大 20")
    args = parser.parse_args()

    qs = {
        "market": args.market,
        "symbol": args.symbol,
        "page": args.page,
        "num": args.num,
    }

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(
        url,
        headers={"X-Auth-Token": token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
