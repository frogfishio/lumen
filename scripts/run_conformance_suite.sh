#!/usr/bin/env bash
set -euo pipefail

# Template runner for the conformance suite.
# Wire this up once the compiler exists.
#
# Expected commands (toolchain-defined):
#   lumen check <file>      # typecheck/validate a single file
#   lumen build <file>      # build a single file/program (hosted)
#
# This script:
# - checks all compile-pass files
# - checks all compile-fail files (expects failure)
# - checks all package fixtures under `conformance-suite/packages`

root="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
suite="$root/conformance-suite"

if ! command -v lumen >/dev/null 2>&1; then
  echo "error: lumen not found in PATH" >&2
  exit 1
fi

echo "[1/2] compile-pass"
while IFS= read -r f; do
  echo "check $f"
  lumen check "$f"
done < <(find "$suite/compile-pass" -type f -name '*.lm' -print | LC_ALL=C sort)

echo "[2/3] compile-fail"
while IFS= read -r f; do
  echo "check (expect fail) $f"
  if lumen check "$f"; then
    echo "error: expected failure: $f" >&2
    exit 1
  fi
done < <(find "$suite/compile-fail" -type f -name '*.lm' -print | LC_ALL=C sort)

echo "[3/3] packages"
while IFS= read -r pkg; do
  echo "build package $pkg"
  (cd "$pkg" && lumen build)
done < <(find "$suite/packages/compile-pass" -type f -name 'lumen.toml' -print0 2>/dev/null | xargs -0 -n1 dirname | LC_ALL=C sort -u)

while IFS= read -r pkg; do
  echo "build package (expect fail) $pkg"
  if (cd "$pkg" && lumen build); then
    echo "error: expected failure: $pkg" >&2
    exit 1
  fi
done < <(find "$suite/packages/compile-fail" -type f -name 'lumen.toml' -print0 2>/dev/null | xargs -0 -n1 dirname | LC_ALL=C sort -u)

echo "ok"
