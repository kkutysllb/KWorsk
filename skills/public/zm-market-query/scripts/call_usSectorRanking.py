#!/usr/bin/env python3
"""调用 Finance Hub API: usSectorRanking — 美股板块列表

Usage:
    python3 call_usSectorRanking.py

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, urllib.request, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/usSectorRanking"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    req = urllib.request.Request(BASE_URL, headers={"X-Auth-Token": token}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
