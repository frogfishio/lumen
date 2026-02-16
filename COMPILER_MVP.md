# Lumen Compiler MVP Plan (v1.0-draft)

This document turns the v1.0 core spec into an implementation checklist for an end-to-end compiler.
It is **non-normative**; `SPEC.md`, `LUMEN_EBNF.md`, `FFI_ABI.md`, and `CORELIB.md` are normative.

## 0. Goal

Produce a working `lumen` compiler that can:
- Parse and typecheck Lumen v1.0 core
- Emit a native object file
- Link an executable
- Interop with C via `extern "C"` and `@repr(C)`
 - Support deterministic C header import (`lumen cimport`) for hosted targets (at least a minimal subset)

## 1. Non-goals (MVP)

- No async/effects/runtime scheduler
- No GC/refcounting
- No closures/lambdas
- No macro system
- No incremental compilation (nice-to-have)
- No full package registry story

## 2. Phased Milestones

### Phase A — Frontend skeleton (parse → AST)
- Lexer: UTF-8, comments, literals, identifiers, keywords (`SPEC.md:20`)
- Parser: enough to round-trip the examples (`examples/`)
- Error recovery: at least “panic-mode” with good spans

Deliverable:
- `lumen parse <file>` prints an AST (or pretty-printed parse tree)

### Phase B — Name resolution (AST → HIR)
- Symbol tables for modules and blocks
- Resolve paths for `use` items and type names
- Detect duplicate definitions and unknown identifiers

Deliverable:
- `lumen check <file>` resolves names and reports undefined symbols with spans

### Phase C — Type checking (HIR → THIR)
Implement typing for:
- Primitives, arrays, tuples, structs, enums (`SPEC.md:74`)
- Function declarations and function values (`SPEC.md:96`)
- Calls, control flow, `match` exhaustiveness (at least for enums + `_`) (`SPEC.md:185`)
- Traits + generics + monomorphization planning (`SPEC.md:205`)
- `try` operator for `Result` returns (`SPEC.md:247`)
- Indexing:
  - `Slice[T]` indexing forms (`SPEC.md:255`)
  - Pointer indexing `p[i]!` inside `unsafe` (`SPEC.md:260`)
- Casts with `as` (`SPEC.md:174`)

Deliverable:
- `lumen check` accepts all `examples/*.lm` and produces typed IR

### Phase D — Safety gate + `unsafe` checking
Implement syntactic and semantic checks:
- `unsafe` contexts (`SPEC.md:116`)
- Operations that require `unsafe` (deref, ptr arithmetic, ptr casts, calling `extern`) (`SPEC.md:123`)
- Ensure `xs[i]!` is rejected outside `unsafe`
- Ensure pointer↔integer casts are rejected outside `unsafe`

Deliverable:
- `lumen check` produces correct “requires unsafe” errors with spans

### Phase E — Monomorphization + codegen
Pick a backend strategy:
- LLVM (fastest path to “real code” and DWARF), or
- Direct asm for one target (more control, more work)

Implement:
- Monomorphization of generic fns/types (instantiate on use)
- Static trait dispatch (select `impl` at compile time)
- Function pointers for `fn(...) -> ...`
- Lowering of `defer` (LIFO) (`SPEC.md:181`)
- Lowering of `try` (early return)
- Bounds checks for `Slice` indexing (trap on OOB)
- Traps lowered to `core.intrinsics.trap()` (`CORELIB.md:57`)

Deliverable:
- `lumen build examples/hello.lm` emits a runnable binary

### Phase F — C interop + ABI conformance
Implement:
- `extern "C"` declarations and calls (`SPEC.md:266`)
- `@repr(C)` struct layout (`FFI_ABI.md:26`)
- `@repr(C)` enum tagged-union layout (`FFI_ABI.md:39`)
- `Slice[T]` ABI mapping (`FFI_ABI.md:14`)
- Function pointer ABI mapping (`FFI_ABI.md:20`)

Deliverable:
- A tiny `c/` fixture:
  - C defines a function taking `struct Slice_u8` and returning something
  - Lumen calls it and verifies the result

## 3. Conformance Tests (recommended early)

Create a `conformance-suite/` folder with “compile-pass” and “compile-fail” fixtures. MVP set:

- `compile-pass/`
  - `hello.lm` (main function)
  - `address_of_safe.lm` (`&place` is safe; creates `Ptr[T]`)
  - `static_zero_init.lm` (`static` defaults to zero-init)
  - `static_init_const.lm` (`static` initializer is compile-time)
  - `defer_order.lm` (nested defers)
  - `defer_break_continue.lm` (`defer` runs on `break`/`continue`)
  - `result_try.lm` (`try` propagation)
  - `for_slice_basic.lm` (`for` over `Slice[T]`)
  - `for_array_basic.lm` (`for` over `[T; N]`)
  - `slice_index_forms.lm` (`xs[i]`, `xs[i]?`, `xs[i]!` in unsafe)
  - `pointer_index_unsafe.lm` (`p[i]!` in unsafe)
  - `match_exhaustive_enum.lm` (enum match is exhaustive)
  - `lexer_nested_comments.lm` (nested block comments; unicode identifiers)
  - `traits_ufcs_call.lm` (trait method call via UFCS)
  - `ffi_union_repr_c.lm` (`@repr(C)` union layout + unsafe field access)
  - `ffi_bitfield_repr_c.lm` (`@repr(C)` bitfields via `@bits(N)`)
  - `ffi_varargs_printf_decl.lm` (`extern "C"` varargs declaration + call)
  - `traits_static_dispatch.lm` (bound + impl selection)
  - `slice_index_checked.lm` (`xs[i]`, `xs[i]?`)
  - `ffi_struct_repr_c.lm` (`@repr(C)` struct)
- `compile-fail/`
  - `unsafe_required_deref.lm` (`*p` outside unsafe)
  - `pointer_index_requires_unsafe.lm` (`p[i]!` outside unsafe)
  - `unsafe_required_extern_call.lm` (`extern` call outside unsafe)
  - `extern_call_requires_unsafe.lm` (`extern "C"` call outside unsafe)
  - `unsafe_required_ptr_cast.lm` (`p as Usize` outside unsafe)
  - `unsafe_required_unchecked_index.lm` (`xs[i]!` outside unsafe)
  - `try_requires_result_return.lm` (`try` in non-Result fn)
  - `for_non_iterable.lm` (`for` requires `Slice[T]` or `[T; N]`)
  - `for_refutable_pat.lm` (refutable `for` pattern rejected)
  - `let_refutable_pat.lm` (refutable `let` pattern rejected)
  - `match_non_exhaustive_enum.lm` (missing enum variant without `_`)
  - `match_guard_not_exhaustive.lm` (guards don’t count for exhaustiveness)
  - `dot_trait_method_rejected.lm` (dot-call does not resolve trait methods; UFCS suggested)
  - `ambiguous_int_literal.lm` (ambiguous integer literal rejected)
  - `ffi_varargs_invalid_arg.lm` (varargs requires promoted C ABI types)
  - `static_mut_requires_unsafe.lm` (`static mut` access requires `unsafe`)
  - `static_init_non_const.lm` (static initializer rejects non-const expressions)
  - `union_field_requires_unsafe.lm` (union field access requires `unsafe`)
  - `bitfield_not_addressable.lm` (`@bits` field cannot be addressed)

Optional feature-gated suites:
- `feature-asm/`
  - `compile-pass/asm_noreturn.lm` (`asm` with `noreturn` has type `Void`)

The runner can be as simple as:
- compile-pass: `lumen check` exits 0
- compile-fail: `lumen check` exits non-0 and matches an error code/message substring

## 4. Implementation Notes (pragmatic choices)

- IR layering: AST → HIR (names) → THIR (typed) → MIR/LLVM IR
- Prefer “good errors early”:
  - Always attach spans
  - Use stable error codes (start a minimal list; see `SPEC.md:287`)
- Keep `core` library hard-coded at first:
  - `Option`, `Result`, `Slice`, `trap` per `CORELIB.md`
  - Treat them as “known items” until module loading exists

## 5. First real-world demo

Target a single showcase that proves the “new C” story:
- A freestanding build artifact (e.g. `--target x86_64-unknown-none`) that links a tiny kernel-style entry stub, OR
- A hosted build calling a C function that takes/returns `@repr(C)` data + `Slice`.
