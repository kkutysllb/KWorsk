#!/usr/bin/env python3
"""调用 Finance Hub API: cnStockKLine — A股股票分钟K线

Usage:
    python3 call_cnStockKLine.py --symbol sh600519 --scale 5 --datalen 100
    python3 call_cnStockKLine.py --symbol sz000002 --scale 1 --datalen 200

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnStockKLine"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnStockKLine — A股股票分钟K线")
    parser.add_argument("--symbol", required=True, help='股票代码，如 sh600519')
    parser.add_argument("--scale", required=True, help='分钟维度: 1/3/5/10/15/30/60')
    parser.add_argument("--datalen", default="100", help='数据长度，正整数，默认100')
    args = parser.parse_args()

    qs = {"symbol": args.symbol, "scale": args.scale, "datalen": args.datalen}
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
