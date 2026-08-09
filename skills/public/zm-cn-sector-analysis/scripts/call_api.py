#!/usr/bin/env python3
"""调用 cnVirtualSectorRanking API 查询行业/板块行情、资金流向及排名。

Usage:
    python3 call_api.py [--index_type hy] [--sort rp_net] [--num 20]

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnVirtualSectorRanking"


def main():
    parser = argparse.ArgumentParser(description="查询行业/板块行情、资金流向及排名（cnVirtualSectorRanking）")
    parser.add_argument("--index_type", default="",
                        help="板块分类：空=全部、hy1=申万1级、hy=申万2级、hy3=申万3级、gn=概念、dy=地域")
    parser.add_argument("--sort", default="percent",
                        help="排序字段：percent/rp_net/bszj1/bszj5/bszj20/totalAmount/turnOver/changes_5d/yearPercent 等")
    parser.add_argument("--asc", default="0", help="排序方向：0=倒序（默认），1=正序")
    parser.add_argument("--page", default="1", help="页码，默认 1")
    parser.add_argument("--num", default="20", help="每页数量（最大30），默认 20")
    args = parser.parse_args()

    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    qs = {
        "sort": args.sort,
        "asc": args.asc,
        "page": args.page,
        "num": args.num,
    }
    if args.index_type:
        qs["index_type"] = args.index_type

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(url, headers={"X-Auth-Token": token}, method="GET")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)
    except urllib.error.URLError as e:
        print(f"URL ERROR: {e.reason}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
