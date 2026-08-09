#!/usr/bin/env python3
"""基金公司简介 - fund_company_info
用法: python3 call_fund_company_info.py <compcode>
说明: compcode 从 fund_info 返回的 CompanyId 获取
示例: python3 call_fund_company_info.py 80000223
"""
import os, sys, json, urllib.request, urllib.parse

def main():
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2:
        print("用法: python3 call_fund_company_info.py <compcode>")
        print("说明: compcode 从 fund_info 返回的 CompanyId 获取")
        sys.exit(1)

    params = urllib.parse.urlencode({"compcode": sys.argv[1]})
    url = f"https://mcp.finance.sina.com.cn/api-call/fund_company_info?{params}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
