#!/usr/bin/env python3
"""基金重仓基金（FOF） - fund_heavy_fund
用法: python3 call_fund_heavy_fund.py <symbol> [page=1] [num=10]
示例: python3 call_fund_heavy_fund.py FD005957
"""
import os, sys, json, urllib.request, urllib.parse

def main():
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2:
        print("用法: python3 call_fund_heavy_fund.py <symbol> [page=1] [num=10]")
        sys.exit(1)

    p = {"symbol": sys.argv[1]}
    if len(sys.argv) > 2:
        p["page"] = sys.argv[2]
    if len(sys.argv) > 3:
        p["num"] = sys.argv[3]

    params = urllib.parse.urlencode(p)
    url = f"https://mcp.finance.sina.com.cn/api-call/fund_heavy_fund?{params}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
