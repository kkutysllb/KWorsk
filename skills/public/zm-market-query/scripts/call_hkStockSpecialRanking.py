#!/usr/bin/env python3
"""调用 Finance Hub API: hkStockSpecialRanking — 港股特色榜单

Usage:
    python3 call_hkStockSpecialRanking.py --node gqg_hk --sort price --asc 0

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/hkStockSpecialRanking"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 hkStockSpecialRanking — 港股特色榜单")
    parser.add_argument("--node", required=True, help='榜单类型: gqg_hk(国企股)/lch_hk(蓝筹股)/hch_hk(红筹股)')
    parser.add_argument("--sort", default="price", help='排序字段: price等')
    parser.add_argument("--asc", default="0", help='排序方向: 0(倒序)/1(正序)')
    parser.add_argument("--page", default=None, help='页码')
    parser.add_argument("--num", default=None, help='每页数量')
    args = parser.parse_args()

    qs = {"node": args.node, "sort": args.sort, "asc": args.asc}
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
