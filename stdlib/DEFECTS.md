# lumen-start defects

This file records defects discovered while using the `lumen-start` experiment as an end-to-end “smoke test” for the Lumen → AST → SIR → sircc → native execution pipeline.

## How to use

- Add a new defect as a new subsection under **Open**.
- Prefer minimal repros that live inside `lumen-start/`.
- If there is a canonical ticket elsewhere (e.g. `src/ast2sir/lumen/tickets/`), link it.
- When fixed, move the subsection to **Fixed** and note the commit / change.

## Open

### DEFECT-001: Importing dependency symbol with `CStr` in signature fails (package mode)

- Status: Open
- Area: `lumenc` package/interface/type import
- Symptom: Building in package mode fails during/around AST generation (“ast failed” / generic failure) when importing a dependency function whose exported signature mentions `CStr`.

Repro (conceptual)
- Dependency exports: `pub extern "C" unsafe fn puts(s: CStr) -> I32;`
- App imports: `use clib::puts;` then `puts(c"hello\n");`

Controls / Workarounds
- Works if `puts` is declared in the app package (no cross-package import).
- Works if dependency uses `Ptr[U8]` instead of `CStr` and app casts: `puts(c"hello\n" as Ptr[U8])`.

Tracking
- Canonical ticket: ../../lumen/tickets/ast__cstr_across_packages.md

---

### DEFECT-002: Varargs calls (e.g. `printf`) are rejected in AST→SIR flow

- Status: Open
- Area: `ast2sir` (call validation) / language feature support
- Symptom: Declaring a varargs extern may parse, but calling it fails (e.g. “arg count mismatch”).

Notes
- This blocks the obvious libc “Hello, world %d” path for now.
- Workaround: avoid varargs; use `puts` / `putchar` style APIs.

---

### DEFECT-003: Some branchy/control-flow-heavy lowering triggers LLVM dominance verification failures

- Status: Open (needs a minimal repro)
- Area: `sircc` lowering / SSA construction
- Symptom: When attempting a manual number-to-decimal printing routine with branches/loops, `sircc` can emit invalid LLVM IR that fails verification (dominance).

Next step
- Capture a minimal `.lm` repro inside `lumen-start/app/src/` that triggers the verifier error reliably.

---

### DEFECT-004: Calling imported `clib::puts` with a `Ptr[U8]` variable crashes `lumenc`

- Status: Open
- Area: `lumenc` (package mode, call/typechecking across package boundary)
- Symptom: In package mode, `use clib::puts;` works if you call it with a literal like `puts(c"Hello\n" as Ptr[U8])`, but `lumenc` fails with `error: ast failed (rc=1)` if the argument is a local variable:

	- Fails: `let msg: Ptr[U8] = c"Hello\n" as Ptr[U8]; puts(msg);`
	- Also fails for pointers derived from argv / pointer math.

Workarounds
- Declare `extern "C" unsafe fn puts(s: Ptr[U8]) -> I32;` in the calling package (don’t import it), then `puts(msg)` works.
- As a stopgap, pass literals directly (no intermediate locals), but that’s not sufficient for argv usage.

---

### DEFECT-005: `extern "C" fn ...;` (void return) calls may be dropped / not observed

- Status: Open (unclear if frontend, ast2sir, or sircc)
- Area: FFI call emission / side-effect preservation
- Symptom: A shim function declared as `extern "C" unsafe fn lf_print_i32(x: I32);` appeared to execute (no crash) but produced no output. Changing the shim to return `I32` and calling it as `let _ = lf_print_i32(x);` made the output appear reliably.

Workaround
- Prefer `-> I32` return types for FFI shims and write calls as `let _ = foo(...);` even if the C function “logically” returns void.

Note
- For “plumbing” tasks (argv/env/printing), a stable pattern so far is: keep all pointer-walking/OS interaction in the C shim, and expose tiny `-> I32` functions that either print internally (`lf_print_*`) or return plain scalars (`lf_*_i32_or`).

---

### DEFECT-006: No turbofish / generic inherent impl (yet)

- Status: Open
- Area: Parser / generic syntax support
- Symptom:
	- `impl Vector[T] { ... }` (generic inherent impl) fails to parse.
	- Calls like `foo::<I32>(...)` also appear unsupported.

Workarounds
- Use free functions (`pub fn push[T](v: &mut Vector[T], ...)`) and rely on type inference.
- Avoid explicit generic call-site syntax; keep APIs inferrable from arguments/return types.

---

### DEFECT-007: `ast2sir` rejects nested type applications in parameter types (e.g. `Ptr[Vector[U8]]`)

- Status: Open
- Area: `ast2sir` type lowering / type constructor support
- Symptom: When a parameter type contains a nested type-application (a type-call used as an argument to another type-call), lowering fails.

Example
- `pub fn len(v: Ptr[Vector[U8]]) -> Usize { ... }`

Observed error
- `ast2sir: ...: <param>: type call expects TypeRef args`

Notes
- This blocks idiomatic “pointer-to-instantiated-generic” APIs.

---

### DEFECT-008: Member access through dereferenced `Ptr[...]` becomes `any` (`Member 'any.len' unsupported`)

- Status: Open
- Area: `ast2sir` expression lowering / pointer deref
- Symptom: Even when a function parameter is typed as `Ptr[SomeStruct]`, `(*p).field` can lower as `any.field`.

Observed error
- `ast2sir: ...: Member 'any.len' unsupported`

Impact
- Prevents passing structs by pointer and reading/writing fields via deref.

---

### DEFECT-009: Generic type constructors are not supported in app code (`Vector[I32]`)

- Status: Open
- Area: `ast2sir` type lowering / generics
- Symptom: Instantiating a generic nominal type in the app (e.g. `Vector[I32]`) fails.

Observed error
- `ast2sir: ...: v: unsupported type constructor 'Vector'`

Workaround
- Use a monomorphic API (or a handle type) and push type-specific operations into the C shim.

---

### DEFECT-010: Returning a struct literal can generate invalid SIR (missing temp `let`, `sircc` unknown name `__tmp_*`)

- Status: Open
- Area: `ast2sir` SIR emission / let-statement ordering
- Symptom: A function that returns a struct literal may lower to an `alloca + store + let __tmp_N`, but the `let __tmp_N` is sometimes omitted from the block’s `stmts` list while still being referenced by a later `name` node.

Observed error
- `sircc: unknown name '__tmp_0'`

Notes
- Triggered by wrappers returning `Vector { handle: h }`.

---

### DEFECT-011: Cross-module `type` aliases are not usable as nominal types via `use` (`unknown nominal type 'Vector'`)

- Status: Open
- Area: `ast2sir` name/type resolution across modules
- Symptom: A type alias declared in another module (e.g. `pub type Vector = Usize;`) does not behave like an importable nominal type.

Observed error
- `ast2sir: ...: v: unknown nominal type 'Vector'`

Workaround
- Use the underlying type (`Usize`) in the importing module.

---

### DEFECT-012: Generic proc type params rejected unless the same module declares a generic nominal type

- Status: Open
- Area: `lumenc` modresolve / generic binder scoping
- Symptom: A module that defines a generic proc like `fn id[T](x: T) -> T { ... }` can fail in `modresolve` with “`'T' is not defined in module`”. This blocks AST emission and thus the rest of the pipeline.

Workaround
- Ensure the *same source file/module* contains at least one generic nominal type declaration (e.g. `struct Dummy[T] { v: T }` or a private “sentinel” generic type). Imports from other modules do not appear to flip the behavior.

Tracking
- Canonical ticket: ../../lumen/tickets/ast__generic_proc_type_params_modresolve.md

---

### DEFECT-013: `types::vector::len` referenced but not emitted into SIR (`sircc.fun.sym.undefined`)

- Status: Open
- Area: `ast2sir` manifest lowering / symbol emission ordering
- Symptom: `make run` can fail in `sircc` with:
	- `fun.sym 'types__vector__len' requires a prior fn or decl.fn of matching signature`

Notes
- The generated SIR contains `fun.sym` nodes for `types__vector__len`, but there is no corresponding `fn` or `decl.fn` record for that symbol (while other `types__vector__*` helpers like `raw_len`/`raw_cap` *are* emitted as `fn`).

## Fixed

(None yet)
