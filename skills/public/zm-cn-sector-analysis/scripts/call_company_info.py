#!/usr/bin/env python3
"""调用 cnCompanyBasicInfo API 查询 A 股公司基础信息（含行业分类）。

Usage:
    python3 call_company_info.py --symbol sh688111

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnCompanyBasicInfo"


def main():
    parser = argparse.ArgumentParser(description="查询 A 股公司基础信息（cnCompanyBasicInfo）")
    parser.add_argument("--symbol", required=True,
                        help="股票代码，格式 sh/sz + 6位数字，如 sh600519、sz000001")
    args = parser.parse_args()

    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    qs = {"symbol": args.symbol}
    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)
    except urllib.error.URLError as e:
        print(f"URL ERROR: {e.reason}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
