#!/usr/bin/env python3
"""调用 Finance Hub API: cnVirtualSectorRanking — A股虚拟板块列表

Usage:
    python3 call_cnVirtualSectorRanking.py --bk hy --sort percent --asc 0
    python3 call_cnVirtualSectorRanking.py --bk gn --sort volume --asc 0

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnVirtualSectorRanking"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnVirtualSectorRanking — A股虚拟板块列表")
    parser.add_argument("--bk", default=None, help='板块类型: hy(行业)/gn(概念)/dy(地域)')
    parser.add_argument("--sort", default="percent", help='排序字段: percent(涨跌幅)/volume(成交量)/turnover(换手率)')
    parser.add_argument("--asc", default="0", help='排序方向: 0(倒序)/1(正序)')
    args = parser.parse_args()

    qs = {}
    if args.bk: qs["bk"] = args.bk
    if args.sort: qs["sort"] = args.sort
    if args.asc: qs["asc"] = args.asc

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
