#!/usr/bin/env python3
"""调用 Finance Hub API: globalStockKlineDaily — 全市场股票日K线

Usage:
    python3 call_globalStockKlineDaily.py --market cn --symbol sz000002
    python3 call_globalStockKlineDaily.py --market hk --symbol 00700 --num 30
    python3 call_globalStockKlineDaily.py --market cn --symbol sh600519 --fq_type qfq --num 60

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/globalStockKlineDaily"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 globalStockKlineDaily — 全市场股票日K线")
    parser.add_argument("--market", required=True, help='市场代码: cn(沪深)/hk(港股)/us(美股)/gi(全球指数)')
    parser.add_argument("--symbol", required=True, help='股票代码，如 sz000002 / 00700 / AAPL')
    parser.add_argument("--fq_type", default=None, help='复权类型: qfq(前复权)/hfq(后复权)，空=不复权')
    parser.add_argument("--compare", default=None, help='对比目标日期: le(小于等于)/ge(大于等于)')
    parser.add_argument("--in_date", default=None, help='目标日期，格式 YYYY-MM-DD，默认当天')
    parser.add_argument("--num", default=None, help='查询数量，正整数，默认1')
    args = parser.parse_args()

    qs = {"market": args.market, "symbol": args.symbol}
    if args.fq_type: qs["fq_type"] = args.fq_type
    if args.compare: qs["compare"] = args.compare
    if args.in_date: qs["in_date"] = args.in_date
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
