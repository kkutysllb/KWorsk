#!/usr/bin/env python3
"""调用 Finance Hub API: futureCommodityList — 国内商品期货

Usage:
    python3 call_futureCommodityList.py --type dce
    python3 call_futureCommodityList.py --type shfe

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/futureCommodityList"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 futureCommodityList — 国内商品期货")
    parser.add_argument("--type", required=True, help='交易所代码: dce(大商所)/shfe(上期所)/czce(郑商所)/gfex(广期所)')
    args = parser.parse_args()

    qs = {"type": args.type}
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
