#!/usr/bin/env python3
"""调用 Finance Hub API: cnSectorComponentsRanking — A股指数和行业板块成分股

Usage:
    python3 call_cnSectorComponentsRanking.py --node sh000001
    python3 call_cnSectorComponentsRanking.py --node sh000001 --sort percent --asc 0 --num 20

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/cnSectorComponentsRanking"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="调用 cnSectorComponentsRanking — A股指数和行业板块成分股")
    parser.add_argument("--node", required=True, help='指数或板块symbol，如 sh000001(上证指数)/diyu_150000(内蒙古)')
    parser.add_argument("--ret", default=None, help='自定义返回字段，逗号分隔')
    parser.add_argument("--sort", default=None, help='排序字段，默认 percent')
    parser.add_argument("--asc", default=None, help='排序方向: 0(倒序)/1(正序)')
    parser.add_argument("--page", default=None, help='页码')
    parser.add_argument("--num", default=None, help='每页数量')
    parser.add_argument("--hnew", default=None, help='含新股: 1(含)/0(不含)')
    parser.add_argument("--hcnew", default=None, help='含次新股: 1(含)/0(不含)')
    args = parser.parse_args()

    qs = {"node": args.node}
    for k in ("ret", "sort", "asc", "page", "num", "hnew", "hcnew"):
        v = getattr(args, k)
        if v is not None: qs[k] = v

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
