#!/usr/bin/env bash
# scripts/sync_deerflow_brand.sh
#
# Brand-normalize helper for syncing upstream bytedance/deer-flow code into the
# OClaw `kkoclaw` engine package (and anywhere else upstream-derived code lands).
#
# Upstream names its harness package `deerflow`; OClaw renamed it to `kkoclaw`.
# After copying upstream files in, run this to rewrite every brand token so the
# code imports / reads as OClaw instead of deer-flow.
#
# Substitution rules (order matters: most specific first):
#   DEERFLOW   -> KKOCLAW
#   DeerFlow   -> KKOCLAW
#   deer_flow  -> kkoclaw
#   deer-flow  -> kkoclaw
#   deerflow   -> kkoclaw
#
# Usage:
#   scripts/sync_deerflow_brand.sh --check PATH...    # report files with residual tokens (no writes); exit 1 if any
#   scripts/sync_deerflow_brand.sh --apply PATH...     # rewrite tokens in place
#   scripts/sync_deerflow_brand.sh PATH...             # same as --apply
#
# PATH may be files or directories (directories are walked; .py/.yaml/.yml/.md/.json/.toml/.txt are scanned).
# Relative paths are resolved against the repo root (parent of this script's dir).
set -euo pipefail

MODE="apply"
if [[ "${1:-}" == "--check" ]]; then MODE="check"; shift; elif [[ "${1:-}" == "--apply" ]]; then MODE="apply"; shift; fi

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 [--check|--apply] PATH..." >&2
  echo "  --check  : report files with residual deer-flow brand tokens (no writes); exit 1 if any found" >&2
  echo "  --apply  : rewrite tokens in place (default)" >&2
  exit 2
fi

# Resolve repo root (this script lives in <root>/scripts/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Regex of file extensions we scan. Binary + vendored dirs are skipped.
SCAN_EXT='\.py$|\.yaml$|\.yml$|\.md$|\.json$|\.toml$|\.txt$|\.mako$|\.ini$|\.cfg$|\.sh$'
SKIP_DIR_RE='/(node_modules|__pycache__|\.git|\.venv|\.next|dist|build|out|playwright-report|test-results|third_party|\.worktrees|logs)/'

# Collect target files.
targets=()
for arg in "$@"; do
  # Allow paths relative to repo root or to CWD.
  if [[ "$arg" = /* ]]; then p="$arg"; else p="$ROOT/$arg"; fi
  if [[ ! -e "$p" ]]; then echo "error: path not found: $p" >&2; exit 2; fi
  if [[ -f "$p" ]]; then
    targets+=("$p")
  else
    while IFS= read -r -d '' f; do
      targets+=("$f")
    done < <(find "$p" -type f \( -name '*.py' -o -name '*.yaml' -o -name '*.yml' -o -name '*.md' -o -name '*.json' -o -name '*.toml' -o -name '*.txt' -o -name '*.mako' -o -name '*.ini' -o -name '*.cfg' -o -name '*.sh' \) -print0)
  fi
done

if [[ ${#targets[@]} -eq 0 ]]; then echo "no scannable files found"; exit 0; fi

# perl substitution (BSD + GNU sed compatible).
# NB: NO word boundaries (\b). The brand tokens never appear as substrings of
# unrelated words — they are always standalone identifiers, prefixes
# (e.g. `deerflow_trace_id`, `DeerFlowClient`, `DEERFLOW_HOME`), suffixes
# (`create_deerflow_agent`), or quoted dict keys. Boundaries would MISS the
# common prefixed forms (DeerFlowClient, deerflow_trace_id, DEERFLOW_HOME)
# because `_`/`.` and adjacent letters are word chars. Order is irrelevant —
# the five needle strings are disjoint, so none shadows another.
substitute() {
  perl -i -pe '
    s/DEERFLOW/KKOCLAW/g;
    s/DEER_FLOW/KKOCLAW/g;
    s/DeerFlow/KKOCLAW/g;
    s/deer_flow/kkoclaw/g;
    s/deer-flow/kkoclaw/g;
    s/deerflow/kkoclaw/g;
  ' "$1"
}

# Grep for any residual brand token (used by --check). Same needle set, unanchored.
residual_re='DEERFLOW|DEER_FLOW|DeerFlow|deer_flow|deer-flow|deerflow'

if [[ "$MODE" == "check" ]]; then
  found=0
  for f in "${targets[@]}"; do
    if grep -nEq "$residual_re" "$f" 2>/dev/null; then
      echo "RESIDUAL: $f"
      grep -nE "$residual_re" "$f" | head -10 | sed 's/^/    /'
      found=1
    fi
  done
  if [[ $found -ne 0 ]]; then
    echo "==> residual deer-flow brand tokens found (see above)" >&2
    exit 1
  fi
  echo "==> no residual deer-flow brand tokens"
  exit 0
fi

# --apply mode
changed=0
for f in "${targets[@]}"; do
  if grep -qEq "$residual_re" "$f" 2>/dev/null; then
    substitute "$f"
    echo "normalized: ${f#$ROOT/}"
    changed=$((changed + 1))
  fi
done
echo "==> $changed file(s) normalized"
