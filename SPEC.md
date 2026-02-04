# Lumen Language Specification (v0.9-draft)

> **Status:** Draft. This document is *normative* unless marked “Non‑normative”.  
> **Goals:** Exceptional DX, predictable correctness, scalable concurrency, pragmatic performance.

---

## 0. Glossary (Normative)
- **Module:** Compilation unit derived from a file.
- **Package:** A publishable unit containing one or more modules.
- **Effect:** A capability required by code (e.g., `async`, `throws`, `io`).
- **Value type:** Type whose values are copied by value (subject to optimization).
- **Reference type:** Type whose values refer to a heap object (subject to runtime).
- **Region:** Optional scoped memory arena (opt-in performance feature).
- **Edition:** A language “epoch” allowing breaking syntax/semantic changes.

---

## 1. Source Text, Lexing, and Tokens (Normative)

### 1.1 Encoding and newlines
- Source files are UTF‑8.
- Newlines are `\n` or `\r\n` and are normalized by the lexer.

### 1.2 Whitespace and layout
- Whitespace separates tokens.
- Lumen supports optional **layout mode** (significant indentation) but the canonical formatter outputs brace style.
  - In layout mode, indentation produces implicit `{}` blocks where unambiguous.
  - The formatter can convert between styles; semantics must match.

### 1.3 Comments
- Line comment: `// ...`
- Block comment: `/* ... */` (nestable)
- Doc comment:
  - `///` item doc
  - `/** ... */` item doc

### 1.4 Identifiers
- Identifier: Unicode XID_Start + XID_Continue (recommended ASCII for public APIs).
- Keywords (reserved):
  `fn let mut if else match for while break continue return
   struct enum trait impl use as pub
   async await throws try defer
   io
   true false
   self super
   unsafe`
- Contextual keywords (not reserved in all positions): `where`, `type`, `macro`, `test`.

### 1.5 Literals
- Integers: `123`, `0xFF`, `0b1010`, `_` separators allowed.
- Floats: `1.0`, `1e-3`, `0x1.2p3` (hex float optional feature).
- Strings: `"..."` with escapes; multi-line `"""..."""`.
- Bytes: `b"..."`, byte literals `0x2A`.
- Rune/char: `'a'`, `'\n'` (Unicode scalar value).
- Interpolated strings: `"Hello, {name}!"` with expression slots.

---

## 2. Program Structure (Normative)

### 2.1 Modules and files
- Each file is a module.
- The package defines a module tree with a root module (`main` for binaries, `lib` for libraries).

### 2.2 Declarations
Top-level items:
- `use` import
- `fn` function
- `struct`, `enum`
- `trait`, `impl`
- `const`, `type` alias (optional feature gate)
- `macro` (optional feature gate)
- `test` blocks (compiled in test builds)

### 2.3 Visibility
- Default: module-private.
- `pub` makes an item public to importing packages.
- `pub(crate)` is public within the package.
- Re-exports supported: `pub use foo::bar`.

---

## 3. Types (Normative)

### 3.1 Primitive types
- `Bool`
- Signed integers: `I8 I16 I32 I64 I128 Isize`
- Unsigned integers: `U8 U16 U32 U64 U128 Usize`
- Floating: `F32 F64`
- `Char` (Unicode scalar)
- `String` (UTF‑8, owned)
- `Bytes` (owned bytes)
- `Unit` written `()`

Aliases:
- `Int` := `I64` (platform stable)
- `UInt` := `U64`

### 3.2 Composite types
- Tuples: `(T1, T2, ...)`
- Arrays: `[T; N]` where `N` is a compile-time constant
- Slices: `[T]` (borrowed view) and `Slice[T]` (library alias)
- Structs (product types)
- Enums (sum types)

### 3.3 Reference and pointer types
- `&T` immutable borrow (safe)
- `&mut T` mutable borrow (safe, exclusive)
- `Ptr[T]` raw pointer (unsafe operations required)
- `Ref[T]` shared runtime reference (GC/ARC-managed object reference), used for reference types
  - Most user-defined `struct` are value types by default.
  - Library-provided reference types include `String`, `Vec[T]`, `Map[K,V]`, etc.

### 3.4 Option and Result
- `Option[T] = Some(T) | None`
- `Result[T, E] = Ok(T) | Err(E)`
- No implicit null; `None` replaces nullability.

### 3.5 Any and dynamic
- `Any` exists as an escape hatch behind a lint warning.
- Runtime type info (RTTI) exists for `Any`, trait objects, and reflection-enabled builds.

### 3.6 Type inference
- Local inference for `let` bindings and closures.
- Public APIs should be explicit where inference would leak ambiguity.

### 3.7 Generics
- Parametric generics: `fn map[T, U](xs: Vec[T], f: fn(T)->U) -> Vec[U]`
- Constraints via `where`:
  `fn sort[T](xs: &mut Vec[T]) where T: Ord { ... }`

### 3.8 Traits (interfaces)
- Traits declare required methods and associated types.
- Implementations via `impl` blocks.
- Coherence rule: A trait can be implemented for a type only in the package that defines the trait or the type (or via explicitly declared “extension packages” under feature gate).

Trait objects:
- `dyn Trait` erased type with vtable (behind `Ref` or `&`).
- Trait object safety rules apply (no generic methods, limited associated types).

---

## 4. Values, Variables, and Bindings (Normative)

### 4.1 Let bindings
- `let x = expr` introduces an immutable binding.
- `let mut x = expr` introduces a mutable binding.
- Shadowing allowed: later `let x = ...` in inner scope.

### 4.2 Assignment
- Assignment requires `mut` binding.
- Compound assignment: `+=`, `-=`, `*=`, `/=`, `%=`, `<<=`, etc.

### 4.3 Destructuring
- Tuples, structs, enums support destructuring:
  - `let (a, b) = pair`
  - `let {x, y} = point`
  - `match opt { Some(v) => ..., None => ... }`

---

## 5. Expressions and Statements (Normative)

### 5.1 Expression-oriented blocks
- Blocks evaluate to the last expression (if no trailing `;`).
- Statements end with `;` and evaluate to `()`.

### 5.2 Operators
- Arithmetic: `+ - * / %`
- Comparison: `== != < <= > >=`
- Boolean: `&& || !`
- Bitwise: `& | ^ ~ << >>`
- Range: `..` (exclusive), `..=` (inclusive)

### 5.3 Control flow
- `if/else` is an expression.
- Loops: `while`, `for x in iter`, `loop` (infinite)
- `break`, `continue`, `return`
- `defer { ... }` executes at scope exit (even on early return)

### 5.4 Pattern matching
- `match` must be exhaustive unless a wildcard `_` is present.
- Guards: `Some(x) if x > 0 => ...`

### 5.5 Closures
- Closure syntax: `fn (x) { x + 1 }`
- Captures inferred; capture by borrow unless moved with `move`.

---

## 6. Effects System (Normative)

### 6.1 Effects in signatures
Functions may require effects:
- `async` — may suspend
- `throws` — may produce recoverable errors
- `io` — may perform IO (filesystem, network, env, clock, randomness)

Example:
```lumen
fn fetch(id: Id) async throws io -> Profile { ... }
```

### 6.2 Effect subtyping
- A function requiring fewer effects can be used where more effects are allowed.
- Not vice versa.

### 6.3 Effect polymorphism
Higher-order functions reflect the effects of their callbacks:
```lumen
fn map[T,U](xs: Vec[T], f: fn(T) throws -> U) throws -> Vec[U] { ... }
```

### 6.4 The `try` operator
- `try expr` unwraps `Result`, propagating `Err` to caller (requires `throws`).

---

## 7. Error Handling (Normative)

### 7.1 Result-first
- Library APIs return `Result` for recoverable failures.
- `throws` indicates a function may short-circuit with `Err`.

### 7.2 Errors are typed
- Standard error trait: `Error` with message + optional cause + optional backtrace.

### 7.3 Panic / abort
- `panic(msg)` is unrecoverable; intended for bugs.
- Panics unwind by default in debug; may abort in release per config.

---

## 8. Concurrency and Async (Normative)

### 8.1 Structured concurrency
- `task { ... }` spawns a child task bound to the current scope.
- Child tasks must be awaited/joined before scope exit, unless detached (requires `io` or `unsafe`).

### 8.2 Async/await
- `await expr` awaits an async value.
- Standard executor provided; pluggable runtimes allowed.

### 8.3 Cancellation
- Cooperative cancellation is propagated through scopes.
- Cancellation token is standard.

### 8.4 Shared state
- Prefer: channels.
- Shared mutation requires explicit sync types.

---

## 9. Memory Model (Normative)

### 9.1 Default model
- Automatic memory management for heap objects.
- Escape analysis may move values to heap.

### 9.2 Borrowing
- `&T` and `&mut T` enforce aliasing rules statically.
- Borrowing across `await` is restricted unless proven safe.

### 9.3 Regions (opt-in)
- `region { ... }` creates an arena; allocations freed at end.
- Escaping values must be copied/promoted.

### 9.4 Unsafe
- `unsafe { ... }` allows raw pointers, FFI, unchecked casts.
- Unsafe code must uphold documented invariants.

---

## 10. Data Types (Normative)

### 10.1 Structs
```lumen
struct Point { x: F64, y: F64 }
```

### 10.2 Enums
```lumen
enum Option[T] { Some(T), None }
```

### 10.3 Methods and impl blocks
- Methods are functions with receivers (feature-gated shorthand allowed).

---

## 11. Modules, Imports, and Packages (Normative)

### 11.1 Imports
- `use path::to::Thing`
- `use foo::bar as baz`
- `use foo::*` discouraged by linter.

### 11.2 Packages
- Manifest: `lumen.toml`
- Lockfile: `lumen.lock`
- Deterministic dependency resolution with checksums.

### 11.3 Build profiles
- `dev`, `test`, `release`
- Feature flags explicit and recorded.

---

## 12. Interoperability (Normative summary; details in FFI_ABI.md)
- C ABI interop supported.
- WASM target supported; JS bridge standard.
- FFI requires `unsafe` unless wrapped safely.

---

## 13. Attributes and Feature Gates (Normative)
- `@inline`, `@deprecated("msg")`, `@test`, `@cfg(feature="x")`
- Experimental features require explicit enablement.

---

## 14. Diagnostics (Normative)
- Every diagnostic has a stable code like `E0421`.
- Diagnostics include machine-readable fix-its when safe.

---

## Appendix A: Evaluation order (Normative)
- Function arguments evaluated left-to-right.
- `&&` and `||` short-circuit.
- `match` scrutinee evaluated once.
