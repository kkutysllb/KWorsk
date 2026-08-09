#!/usr/bin/env python3
"""调用 Finance Hub API: cnStockTradingMarginList — A股股票融资融券

Usage:
    python3 call_cnStockTradingMarginList.py --symbol sz000002
    python3 call_cnStockTradingMarginList.py --symbol sz000002 --page 2 --num 20

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnStockTradingMarginList"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnStockTradingMarginList — A股股票融资融券")
    parser.add_argument("--symbol", required=True, help='股票代码，如 sz000002')
    parser.add_argument("--page", default=None, help='页码，正整数')
    parser.add_argument("--num", default=None, help='每页数量，正整数')
    args = parser.parse_args()

    qs = {"symbol": args.symbol}
    if args.page: qs["page"] = args.page
    if args.num: qs["num"] = args.num

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
