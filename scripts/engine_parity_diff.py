# scripts/engine_parity_diff.py
"""Compare the kkoclaw engine package against a local deer-flow checkout.

Three modes:
  default          Quick file-list parity: only-upstream / only-kkoclaw / common counts.
  --classify       Also bucket the *common* files into:
                     brand-only  (identical after normalizing deerflow<->kkoclaw brand tokens)
                     differ      (real code differences remain after brand normalization)
                   This is the per-batch regression gate during upstream resyncs.
  --diff FILE      Show the brand-normalized diff for a single common file.

Usage:
  uv run python scripts/engine_parity_diff.py [upstream_root] [--classify] [--diff REL_PATH]

upstream_root defaults to /tmp/deer-flow-upstream and must contain
backend/packages/harness/deerflow.
"""
import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

# Brand-token needles (unanchored — see scripts/sync_deerflow_brand.sh for rationale).
# Covers all case/split variants: DEERFLOW / DEER_FLOW (env-var style),
# DeerFlow (class style), deer_flow / deer-flow / deerflow (identifier/path style).
BRAND_NEEDLES = ["DEERFLOW", "DEER_FLOW", "DeerFlow", "deer_flow", "deer-flow", "deerflow"]
_BRAND_RE = re.compile("|".join(re.escape(n) for n in BRAND_NEEDLES))


def normalize_brand(text: str) -> str:
    """Rewrite every brand token to a single canonical placeholder."""
    return _BRAND_RE.sub("PKG", text)


def collect(root):
    """All tracked-ish files under root, relative paths, excluding caches/builds."""
    files = set()
    for dp, dn, fn in os.walk(root):
        parts = dp.split(os.sep)
        if any(p in {"__pycache__", ".git", ".venv", "node_modules", "dist", "build"} for p in parts):
            continue
        for f in fn:
            if f.endswith(".pyc"):
                continue
            files.add(os.path.relpath(os.path.join(dp, f), root))
    return files


def is_brand_only(up_path: Path, kk_path: Path) -> bool:
    """True if upstream and local differ ONLY in brand tokens."""
    try:
        up = up_path.read_text(encoding="utf-8", errors="replace")
        kk = kk_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return False
    return normalize_brand(up) == normalize_brand(kk)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("upstream_root", nargs="?", default="/tmp/deer-flow-upstream")
    ap.add_argument("--classify", action="store_true", help="bucket common files into brand-only vs differ")
    ap.add_argument("--diff", metavar="REL_PATH", help="show brand-normalized diff for one common file")
    args = ap.parse_args()

    up_pkg = Path(args.upstream_root) / "backend/packages/harness/deerflow"
    kk_pkg = Path("backend/packages/harness/kkoclaw")
    if not up_pkg.is_dir():
        sys.exit(f"upstream package not found: {up_pkg}")
    if not kk_pkg.is_dir():
        sys.exit(f"local package not found: {kk_pkg}")

    if args.diff:
        rel = args.diff
        up_file = up_pkg / rel
        kk_file = kk_pkg / rel
        if not up_file.is_file() and not kk_file.is_file():
            sys.exit(f"file not found on either side: {rel}")
        if not up_file.is_file():
            sys.exit(f"only-local file (no upstream): {rel}")
        if not kk_file.is_file():
            sys.exit(f"only-upstream file (not yet ported): {rel}")
        # `diff <(norm a) <(norm b)` via git --no-index on temp normalized blobs.
        import tempfile
        with tempfile.NamedTemporaryFile("w", suffix=".up", delete=False) as ua, \
             tempfile.NamedTemporaryFile("w", suffix=".kk", delete=False) as ka:
            ua.write(normalize_brand(up_file.read_text(encoding="utf-8", errors="replace")))
            ka.write(normalize_brand(kk_file.read_text(encoding="utf-8", errors="replace")))
            ua.flush(); ka.flush()
            subprocess.run(["diff", "-u", ua.name, ka.name])
        return

    up_files = collect(up_pkg)
    kk_files = collect(kk_pkg)
    only_up = sorted(up_files - kk_files)
    only_kk = sorted(kk_files - up_files)
    common = sorted(up_files & kk_files)

    print(f"upstream root : {args.upstream_root}")
    print(f"ONLY UPSTREAM (port candidates): {len(only_up)}")
    print(f"ONLY KKOCLAW  (preserve):       {len(only_kk)}")
    print(f"COMMON (in both):               {len(common)}")

    if args.classify:
        brand_only, differ = [], []
        for rel in common:
            (brand_only if is_brand_only(up_pkg / rel, kk_pkg / rel) else differ).append(rel)
        print(f"  └─ brand-only (no real diff): {len(brand_only)}")
        print(f"  └─ differ (real changes):    {len(differ)}")
        print("\n=== COMMON: BRAND-ONLY ===")
        for p in brand_only:
            print("  " + p)
        print("\n=== COMMON: DIFFER (real changes remain) ===")
        for p in differ:
            print("  " + p)

    print("\n=== ONLY UPSTREAM (port candidates) ===")
    for p in only_up:
        print("  " + p)
    print("\n=== ONLY KKOCLAW (preserve) ===")
    for p in only_kk:
        print("  " + p)


if __name__ == "__main__":
    main()
