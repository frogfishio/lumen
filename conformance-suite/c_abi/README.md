# C ABI Conformance Harness

This folder provides a target-specific conformance harness that validates Lumen’s FFI/ABI claims against the platform C toolchain.

## What it tests
- `@repr(C)` structs: `sizeof`, `alignof`, `offsetof`, and byte layouts
- `@repr(C)` unions: byte layouts (unsafe field access invariant remains the programmer’s responsibility)
- `@bits(N)` bitfields: byte layouts for representative values (matches platform C ABI rules)
- C varargs (`...`): calling convention sanity checks for a small set of promoted argument types

## Structure
- `c/layouts.h`: canonical C definitions used as the oracle
- `c/probe.c`: exports C ABI functions that:
  - report sizes/alignments/offsets
  - pack structs/unions into byte buffers
  - provide a varargs function used for calling-convention checks
- `lumen/layouts.lm`: matching Lumen type definitions
- `lumen/test_abi.lm`: calls into `probe.c` and traps on mismatch
- `run.sh`: build+link+run script (start with one hosted target)

## Running
This harness assumes:
- a C compiler (`cc` or `clang`) is available
- the `lumen` compiler can build and link hosted binaries

Run:
```sh
./conformance-suite/c_abi/run.sh
```

If your `lumen` toolchain does not yet support “emit object” + linking, treat `run.sh` as a template and wire it up once the build pipeline exists.
