# lumen-start: known breakages / repros

This file is intentionally practical: each entry includes **how to reproduce** and **what failed**, so we can re-check it later even if the triggering code was reverted.

## 2026-02-23 — `sircc` lowering failure from simple `lumen::string::len/is_empty` wrappers

### Symptom
After adding two very small wrappers in `lumen::string` and exercising them from the app smoke harness, the build failed in `sircc` while lowering `out/dev/app.sir.jsonl`.

Observed failures (two attempts):

1) First attempt (wrappers called `slice::len` / `slice::is_empty`):

- `out/dev/app.sir.jsonl: error: sircc: fun call arg[0] type mismatch (want=ptr, got=i64)`
  - `code: sircc.call.fun.arg_type_mismatch`
  - `record: k=node id=1343 tag=call.fun`

2) Second attempt (wrappers used direct field access like `bytes.len`):

- `out/dev/app.sir.jsonl: error: sircc: ptr.offset requires ptr base`
  - `code: sircc.operand.type_bad`
  - `record: k=node id=1326 tag=ptr.offset`

### Trigger
Patch: `repro/sircc_string_len_is_empty.patch`

This patch:
- adds `pub fn len(bytes: Slice[U8]) -> Usize` and `pub fn is_empty(bytes: Slice[U8]) -> bool` to `packages/lumen/src/string.lm`
- adds a couple `invariant(...)` checks in `app/src/main.lm` to ensure they’re referenced

### Reproduce
From `src/ast2sir/experiment/lumen-start`:

- Apply the patch: `git apply repro/sircc_string_len_is_empty.patch`
- Run: `make run`

### Cleanup / revert
- Revert patch: `git apply -R repro/sircc_string_len_is_empty.patch`

### Notes
We reverted the change immediately to keep `make run` green. Keeping a patch-based repro lets us revisit the underlying lowering issue later without blocking JSON/stdlib progress.
