# Lumen Conformance Suite

This folder is the single source of truth for Lumen’s conformance fixtures: a compiler **test corpus** used to prove the implementation matches the spec.

Layout:
- `compile-pass/`: programs that must compile for a v1.0 core toolchain
- `compile-fail/`: programs that must fail (preferably with a stable error code)
- `feature-*/`: feature-gated suites (optional; not required for core conformance)
- `c_abi/`: C ABI oracle harness (C + Lumen, target-specific; validates unions/bitfields/varargs/layout)

These fixtures focus on the core profile defined by:
- `SPEC.md`
- `LUMEN_EBNF.md`
- `CORELIB.md`
- `FFI_ABI.md`
