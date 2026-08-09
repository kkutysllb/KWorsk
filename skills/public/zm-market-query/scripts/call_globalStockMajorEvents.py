#!/usr/bin/env python3
"""调用 Finance Hub API: globalStockMajorEvents — 全市场公司重大事项

Usage:
    python3 call_globalStockMajorEvents.py --symbols 600000 --market 0 --pageSize 10
    python3 call_globalStockMajorEvents.py --symbols 00700 --market 1 --pageSize 5

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockMajorEvents"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 globalStockMajorEvents — 全市场公司重大事项")
    parser.add_argument("--symbols", required=True, help='股票代码，如 600000')
    parser.add_argument("--market", required=True, help='市场代码: 0(沪深)/1(港股)/2(美股)')
    parser.add_argument("--pageSize", required=True, help='返回数量，正整数')
    args = parser.parse_args()

    qs = {"symbols": args.symbols, "market": args.market, "pageSize": args.pageSize}
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
