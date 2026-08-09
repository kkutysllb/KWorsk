#!/usr/bin/env python3
"""调用 Finance Hub API: cnFinanceRevenueComposition — A股公司主营构成

Usage:
    python3 call_cnFinanceRevenueComposition.py --paperCode sz000002
    python3 call_cnFinanceRevenueComposition.py --paperCode sz000002 --rDate 20231231

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnFinanceRevenueComposition"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnFinanceRevenueComposition — A股公司主营构成")
    parser.add_argument("--paperCode", required=True, help='股票代码，如 sz000002')
    parser.add_argument("--rDate", default=None, help='财报日期，YYYYMMDD格式')
    args = parser.parse_args()

    qs = {"paperCode": args.paperCode}
    if args.rDate: qs["rDate"] = args.rDate

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
