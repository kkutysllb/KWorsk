#!/usr/bin/env python3
"""调用 Finance Hub API: cnMarketStrongSectors — A股强势板块列表

Usage:
    python3 call_cnMarketStrongSectors.py --type all --isNotSt 1 --bk gn
    python3 call_cnMarketStrongSectors.py --type cyb --bk hy

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnMarketStrongSectors"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnMarketStrongSectors — A股强势板块列表")
    parser.add_argument("--type", default="all", help='市场类型: all(全市场)/cyb(创业板+科创板)/其他')
    parser.add_argument("--isNotSt", default="1", help='是否含ST: 1(不含)/0(含)')
    parser.add_argument("--bk", default="gn", help='板块类型: gn(概念)/hy(行业)/dy(地域)')
    args = parser.parse_args()

    qs = {"type": args.type, "isNotSt": args.isNotSt, "bk": args.bk}
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
