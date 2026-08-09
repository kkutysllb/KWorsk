#!/usr/bin/env python3
"""基金核心风险指标 - fund_core_metrics
返回最大回撤、夏普比率、波动率及同类排名
用法: python3 call_fund_core_metrics.py <symbol>
示例: python3 call_fund_core_metrics.py 260108
"""
import os, sys, json, urllib.request, urllib.parse

def main():
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) < 2:
        print("用法: python3 call_fund_core_metrics.py <symbol>")
        sys.exit(1)

    params = urllib.parse.urlencode({"symbol": sys.argv[1]})
    url = f"https://mcp.finance.sina.com.cn/api-call/fund_core_metrics?{params}"
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")
    with urllib.request.urlopen(req, timeout=15) as resp:
        result = json.loads(resp.read())
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
