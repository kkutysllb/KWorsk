#!/usr/bin/env python3
"""调用 Finance Hub API: cnStockValuationDetail — A股公司估值数据

Usage:
    python3 call_cnStockValuationDetail.py --symbol sz000002 --rank y1 --type syl
    python3 call_cnStockValuationDetail.py --symbol sh600519 --rank y3 --type sjl

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnStockValuationDetail"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnStockValuationDetail — A股公司估值数据")
    parser.add_argument("--symbol", required=True, help='股票代码，如 sz000002')
    parser.add_argument("--rank", required=True, help='时间跨度: y1(1年)/y3(3年)/y5(5年)/y10(10年)/all')
    parser.add_argument("--type", required=True, help='估值指标: syl(市盈率TTM)/sjl(市净率)/sxl(市现率)/gxl(股息率)/zsz(总市值)')
    args = parser.parse_args()

    qs = {"symbol": args.symbol, "rank": args.rank, "type": args.type}
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
