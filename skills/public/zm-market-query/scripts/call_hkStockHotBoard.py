#!/usr/bin/env python3
"""调用 Finance Hub API: hkStockHotBoard — 港股热度榜

Usage:
    python3 call_hkStockHotBoard.py
    python3 call_hkStockHotBoard.py --pageIndex 1 --pageSize 10

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/hkStockHotBoard"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 hkStockHotBoard — 港股热度榜")
    parser.add_argument("--pageIndex", default=None, help='页码，正整数')
    parser.add_argument("--pageSize", default=None, help='每页数量，正整数')
    args = parser.parse_args()

    qs = {}
    if args.pageIndex: qs["pageIndex"] = args.pageIndex
    if args.pageSize: qs["pageSize"] = args.pageSize

    url = BASE_URL + ("?" + urllib.parse.urlencode(qs) if qs else "")
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
