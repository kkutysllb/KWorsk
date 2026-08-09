#!/usr/bin/env python3
"""调用 cnSectorComponentsRanking API 查询行业/指数成分股排行。"""

import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnSectorComponentsRanking"


def main():
    parser = argparse.ArgumentParser(description="查询行业/指数成分股排行（cnSectorComponentsRanking）")
    parser.add_argument("--node", required=True, help="板块/指数代码，如 sh000001（上证指数）或行业 index_code")
    parser.add_argument("--sort", default="percent", help="排序字段，默认 percent（涨跌幅）")
    parser.add_argument("--asc", default="0", help="排序方向，0=倒序（默认），1=正序")
    parser.add_argument("--page", default="1", help="页码，默认 1")
    parser.add_argument("--num", default="50", help="每页数量，默认 50")
    parser.add_argument("--ret", default="", help="自定义返回字段（英文逗号分隔），不填返回全部")
    parser.add_argument("--hnew", default="1", help="是否含新股，1=含（默认），0=不含")
    args = parser.parse_args()

    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)

    qs = {
        "node": args.node,
        "sort": args.sort,
        "asc": args.asc,
        "page": args.page,
        "num": args.num,
        "hnew": args.hnew,
    }
    if args.ret:
        qs["ret"] = args.ret

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
