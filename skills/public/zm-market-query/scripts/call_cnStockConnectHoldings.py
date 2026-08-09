#!/usr/bin/env python3
"""调用 Finance Hub API: cnStockConnectHoldings — A股沪深港通

Usage:
    python3 call_cnStockConnectHoldings.py --type hk --sort hold_ratio --asc 0
    python3 call_cnStockConnectHoldings.py --type sz --sort percent --asc 0 --page 1 --num 10

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnStockConnectHoldings"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnStockConnectHoldings — A股沪深港通")
    parser.add_argument("--type", required=True, help='通类型: hk(港股通)/sz(深股通)/sh(沪股通)')
    parser.add_argument("--sort", required=True, help='排序字段: hold_ratio(持股比例)/percent(涨跌幅)等')
    parser.add_argument("--asc", required=True, help='排序方向: 0(从大到小)/1(从小到大)')
    parser.add_argument("--page", default=None, help='页码')
    parser.add_argument("--num", default=None, help='每页数量')
    args = parser.parse_args()

    qs = {"type": args.type, "sort": args.sort, "asc": args.asc}
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
