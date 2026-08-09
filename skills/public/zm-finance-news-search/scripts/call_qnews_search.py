#!/usr/bin/env python3
"""调用 Finance Hub API: qNewsSearch（快讯搜索）

按关键词搜索财经快讯，适合实时动态、盘中行情播报、突发事件速报。

Usage:
    python3 call_qnews_search.py --keyword "美联储降息" [--page 1] [--num 10]

Environment:
    X_AUTH_TOKEN  - 认证 token（必须设置）
"""
import os, sys, json, argparse, urllib.request, urllib.parse, urllib.error

BASE_URL = "https://mcp.finance.sina.com.cn/api-call/qNewsSearch"


def get_token() -> str:
    token = os.environ.get("X_AUTH_TOKEN", "")
    if not token:
        print("ERROR: 环境变量 X_AUTH_TOKEN 未设置", file=sys.stderr)
        sys.exit(1)
    return token


def main():
    token = get_token()

    parser = argparse.ArgumentParser(description="搜索财经快讯（qNewsSearch API）")
    parser.add_argument("--keyword", required=True,
                        help="关键词，多个用英文逗号分隔，最多10个，每个最长15字符。示例：'美联储,降息'")
    parser.add_argument("--page", type=int, default=1, help="页码，默认1")
    parser.add_argument("--num", type=int, default=10, help="每页条数，默认10，最大20")
    args = parser.parse_args()

    qs = {"keyword": args.keyword, "page": args.page, "num": args.num}

    url = BASE_URL + "?" + urllib.parse.urlencode(qs)
    req = urllib.request.Request(
        url,
        headers={"X-Auth-Token": token},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read())
            print(json.dumps(result, ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as e:
        print(f"HTTP ERROR {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
