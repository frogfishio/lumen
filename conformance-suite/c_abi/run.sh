#!/usr/bin/env sh
set -eu

root="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
work="${TMPDIR:-/tmp}/lumen_c_abi.$$"
mkdir -p "$work"

cc="${CC:-cc}"

echo "[1/3] Build C probe"
"$cc" -std=c11 -O2 -I"$root/conformance-suite/c_abi/c" -c "$root/conformance-suite/c_abi/c/probe.c" -o "$work/probe.o"

echo "[2/3] Build Lumen test object"
# This is a template. Wire this up to your actual compiler flags once `lumen` can emit objects.
# Suggested shape:
#   lumen build <file> --emit obj -o <out.o>
if ! command -v lumen >/dev/null 2>&1; then
  echo "error: lumen not found in PATH" >&2
  echo "built: $work/probe.o" >&2
  exit 1
fi

lumen build "$root/conformance-suite/c_abi/lumen/test_abi.lm" --emit obj -o "$work/test_abi.o"

echo "[3/3] Link + run"
"$cc" "$work/test_abi.o" "$work/probe.o" -o "$work/abi_test"
"$work/abi_test"

echo "ok: $work/abi_test"
