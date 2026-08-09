#!/usr/bin/env python3
"""调用 Finance Hub API: cnCompanyShareholderHistory — A股公司股东人数

Usage:
    python3 call_cnCompanyShareholderHistory.py --Code 601127 --Type amount
    python3 call_cnCompanyShareholderHistory.py --Code 601127 --Type average

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnCompanyShareholderHistory"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnCompanyShareholderHistory — A股公司股东人数")
    parser.add_argument("--Code", required=True, help='不带前缀的A股代码，如 601127')
    parser.add_argument("--Type", required=True, help='数据类型: amount(股东总数) / average(平均持股数)')
    args = parser.parse_args()

    qs = {"Code": args.Code, "Type": args.Type}
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
