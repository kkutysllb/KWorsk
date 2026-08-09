#!/usr/bin/env python3
"""调用 Finance Hub API: globalStockQuoteRealtime — 股票实时行情（A港美）

Usage:
    python3 call_globalStockQuoteRealtime.py --market cn --symbol sh688001
    python3 call_globalStockQuoteRealtime.py --market hk --symbol 00700
    python3 call_globalStockQuoteRealtime.py --market us --symbol AAPL

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockQuoteRealtime"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 globalStockQuoteRealtime — 股票实时行情")
    parser.add_argument("--market", required=True, help='市场代码: cn(沪深)/hk(港股)/us(美股)/gi(全球指数)')
    parser.add_argument("--symbol", required=True, help='股票代码，如 sh688001 / 00700 / AAPL')
    args = parser.parse_args()

    qs = {"market": args.market, "symbol": args.symbol}
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
