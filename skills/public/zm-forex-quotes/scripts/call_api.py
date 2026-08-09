#!/usr/bin/env python3
"""调用 Finance Hub API: forexQuoteLatest（单货币对汇率查询）

所有 api-call 统一使用 GET，参数通过 Query String 传递。

Usage:
    python3 call_api.py --symbol USDCNY

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置，调用 API 时校验）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/forexQuoteLatest"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 forexQuoteLatest API（单货币对汇率查询）")
    parser.add_argument("--symbol", required=True, help="货币对代码，全大写，如 USDCNY、EURUSD")
    args = parser.parse_args()

    qs = {"symbol": args.symbol.upper()}

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
