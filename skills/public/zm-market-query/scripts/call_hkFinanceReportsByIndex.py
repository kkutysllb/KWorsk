#!/usr/bin/env python3
"""调用 Finance Hub API: hkFinanceReportsByIndex — 港股财务指标

Usage:
    python3 call_hkFinanceReportsByIndex.py --symbol 00700 --source lrb --field lrb --type 0 --num 5 --currencyType 2

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/hkFinanceReportsByIndex"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 hkFinanceReportsByIndex — 港股财务指标")
    parser.add_argument("--symbol", required=True, help='港股代码，如 00700')
    parser.add_argument("--source", required=True, help='数据来源: lrb(利润表)/fzb(负债表)/llb(流量表)/gjzb(关键指标)')
    parser.add_argument("--field", required=True, help='指标代码，同source')
    parser.add_argument("--type", required=True, help='报告类型: 0(全部)/1(一季报)/2(半年报)/3(三季报)/4(年报)')
    parser.add_argument("--num", required=True, help='返回数量，正整数')
    parser.add_argument("--currencyType", default="2", help='货币类型: 1(原始)/2(港币)/3(人民币)/4(美元)，默认2')
    args = parser.parse_args()

    qs = {
        "symbol": args.symbol, "source": args.source, "field": args.field,
        "type": args.type, "num": args.num, "currencyType": args.currencyType,
    }
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
