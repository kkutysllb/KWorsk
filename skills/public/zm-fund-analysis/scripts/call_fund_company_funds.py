#!/usr/bin/env python3
"""基金公司旗下基金列表 - fund_company_funds
用法: python3 call_fund_company_funds.py <compcode> [page=1] [num=20]
示例: python3 call_fund_company_funds.py 80000223
"""
import os, sys, json, urllib.request, urllib.parse

def main():
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2:
        print("用法: python3 call_fund_company_funds.py <compcode> [page=1] [num=20]")
        sys.exit(1)

    p = {"compcode": sys.argv[1]}
    p["page"] = sys.argv[2] if len(sys.argv) > 2 else "1"
    p["num"] = sys.argv[3] if len(sys.argv) > 3 else "20"

    params = urllib.parse.urlencode(p)
    url = f"https://mcp.finance.sina.com.cn/api-call/fund_company_funds?{params}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
