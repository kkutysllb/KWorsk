#!/usr/bin/env python3
"""调用 Finance Hub API: forexQuotesBatch（批量货币对汇率查询）

所有 api-call 统一使用 GET，参数通过 Query String 传递。

Usage:
    python3 call_forexQuotesBatch.py --from USD --to CNY,JPY,EUR

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置，调用 API 时校验）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/forexQuotesBatch"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 forexQuotesBatch API（批量货币对汇率查询）")
    parser.add_argument("--from", dest="from_currency", required=True,
                        help="基础货币代码（ISO 4217），如 USD、EUR")
    parser.add_argument("--to", dest="to_currencies", required=True,
                        help="目标货币代码，逗号分隔，如 CNY,JPY,EUR")
    args = parser.parse_args()

    qs = {
        "from": args.from_currency.upper(),
        "to": args.to_currencies.upper(),
    }

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(
        url,
        headers={"X-Auth-Token": token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
