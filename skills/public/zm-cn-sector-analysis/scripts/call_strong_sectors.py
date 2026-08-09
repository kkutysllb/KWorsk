#!/usr/bin/env python3
"""调用 cnMarketStrongSectors API 查询 A 股强势板块列表。"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnMarketStrongSectors"


def main():
    parser = argparse.ArgumentParser(description="查询 A 股强势板块列表（cnMarketStrongSectors）")
    parser.add_argument("--bk", default="gn", help="板块类型：gn=概念（默认）、hy=行业、dy=地域")
    parser.add_argument("--type", default="all", help="市场范围：all=全市场（默认）、ck=科创板+创业板、other=其他")
    parser.add_argument("--isNotSt", default="1", help="是否排除ST：1=排除（默认）、0=包含")
    args = parser.parse_args()

    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    qs = {
        "bk": args.bk,
        "type": args.type,
        "isNotSt": args.isNotSt,
    }

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"URL ERROR: {e.reason}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
