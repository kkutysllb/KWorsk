#!/usr/bin/env python3
"""调用 Finance Hub API: globalStockSearchSymbols — 全市场股票代码搜索

Usage:
    python3 call_globalStockSearchSymbols.py --type 11 --key 茅台
    python3 call_globalStockSearchSymbols.py --type 11,31 --key 苹果

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockSearchSymbols"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 globalStockSearchSymbols — 全市场股票代码搜索")
    parser.add_argument("--type", required=True, help='市场类型: 11(A股)/12(B股)/31(港股股票)等，多市场逗号分隔')
    parser.add_argument("--key", required=True, help='搜索关键词')
    parser.add_argument("--format", default="text", help='返回格式，固定text')
    parser.add_argument("--num", default="4", help='返回数量，固定4')
    args = parser.parse_args()

    qs = {"type": args.type, "key": args.key, "format": args.format, "num": args.num}
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
