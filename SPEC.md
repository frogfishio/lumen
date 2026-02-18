# Lumen Language Specification (v1.0-draft)

> **Status:** Draft. This document is *normative* unless marked “Non‑normative”.  
> **Positioning:** Lumen is a **freestanding-first**, **C ABI-native**, small language intended to be a *real* C replacement.

This v1.0 spec defines the **core language**. A hosted “std” profile (allocator + OS + networking + richer concurrency)
may exist later, but is intentionally *out of scope* here.

## 0. Glossary (Normative)
- **Core profile:** Freestanding language + core library; no OS assumptions; no mandatory allocator.
- **Hosted profile:** Optional environment with an allocator and OS-backed libraries.
- **Safe code:** Code outside `unsafe` that must not trigger undefined behavior.
- **Unsafe code:** Code within `unsafe { ... }` or `unsafe fn` which may use operations requiring manual invariants.
- **Module:** Compilation unit derived from a file.
- **Package:** A publishable unit containing one or more modules.
- **Edition:** A language epoch allowing breaking changes.

## 1. Source Text, Lexing, and Tokens (Normative)

### 1.1 Encoding and newlines
- Source files are UTF‑8.
- Newlines are `\n` or `\r\n` and are normalized by the lexer.

### 1.2 Whitespace
- Whitespace separates tokens.

### 1.3 Comments
- Line comment: `// ...`
- Block comment: `/* ... */` (nestable)
- Doc comment:
  - `///` item doc
  - `/** ... */` item doc

### 1.4 Identifiers
- Identifier: Unicode XID_Start + XID_Continue (recommended ASCII for public APIs).

Reserved keywords:
`fn let mut if else match for while loop break continue return
 struct enum trait impl use as pub mod
 try defer
 true false
 self super
 extern static unsafe
 in`

Contextual keywords (not reserved in all positions): `where`, `type`, `const`, `macro`, `test`.
Additional contextual keyword used by this spec: `asm`.

### 1.5 Literals
- Integers: `123`, `0xFF`, `0b1010`, `_` separators allowed.
- Floats: `1.0`, `1e-3` (floating point is optional in some freestanding targets; see §3.1).
- UTF‑8 strings: `"..."` (cooked) and `r"..."` (raw).
- Bytes: `b"..."` (cooked bytes), byte literals `0x2A`.
- C strings: `c"..."` (cooked UTF‑8, NUL-terminated).
- Rune/char: `'a'`, `'\n'` (Unicode scalar value).

## 2. Program Structure (Normative)

### 2.1 Modules and files
Each file is a module. The package defines a module tree with a root module.

#### 2.1.1 Package root
- A binary package root module is `src/main.lm`.
- A library package root module is `src/lib.lm`.
- Exactly one of `src/main.lm` or `src/lib.lm` must exist.

#### 2.1.2 File module declaration (`mod name;`) (Normative)
Each Lumen source file may begin (after comments/whitespace) with a **file module declaration**:

```lumen
mod steve;
```

Rules (normative):
- `mod <module_path>;` declares the module path that the file’s items belong to.
- `<module_path>` is one or more identifiers separated by `::` (e.g. `a`, `a::b`, `sys::io`).
- After the file module declaration, the remainder of the file must be a sequence of items (see §2.2).

Defaults (normative for hosted packages):
- If `src/main.lm` has no file module declaration, it is treated as if it began with `mod main;`.
- If `src/lib.lm` has no file module declaration, it is treated as if it began with `mod lib;`.
- In a package build, any other `.lm` file under `src/` without a file module declaration is a compile-time error (`E0510`), because it would implicitly declare `main`/`lib` and collide with the package root.

Standalone compilation (normative recommendation):
- A toolchain that compiles a single source file without a package context should treat it as the package root (i.e. default module path `main`).

Uniqueness (normative):
- It is a compile-time error for two source files in the same package to declare the same module path.
- If a file declares module path `a::b`, then module path `a` must exist in the package (declared by some file or by an inline `mod a { ... }` in the appropriate parent).

#### 2.1.3 Inline submodules (`mod name { ... }`) (Normative)
In addition to file-based modules, a module may define inline submodules using:

```lumen
mod name {
  /* items */
}
```

Rules (normative):
- `mod name { ... }` defines a child module named `name` within the current module.
- An inline module introduces a namespace. Items declared inside are accessed as `name::Item`.
- The contents of a `mod` block are items only (`use`, `fn`, `static`, `struct`, `enum`, `union`, `trait`, `impl`, `extern`, nested `mod`, and feature-gated items).
- Paths starting with `super::` inside an inline module refer to the parent module.
- An inline module exists only within the containing source file and does not imply any filesystem layout.

Interaction with file modules (normative):
- File modules and inline modules share the same module namespace.
- It is a compile-time error for a module to have both:
  - a file module child named `x` (e.g. `src/parent/x.lm` or `src/parent/x/...`), and
  - an inline module `mod x { ... }`
  in the same parent module.

#### 2.1.4 Binary entry point (`main::main`) (Hosted toolchains; normative when applicable)
The v1.0 core language is freestanding-first and does not require an OS or process model.
However, hosted toolchains that build executable programs must define a standard entry point.

Rules (normative for hosted toolchains):
- A binary package must define a function named `main` in module `main` (i.e. the entry point is `main::main`).
- `main` must be non-generic and must not be `unsafe`.
- The only supported `main` signatures in v1.0 are:
  - `fn main() { ... }` (i.e. return type `()`)
  - `fn main() -> I32 { ... }`
- If `main` returns `()`, the process exit code is `0`.
- If `main` returns `I32`, the process exit code is that value (platform mapping is toolchain-defined but must be deterministic).

Freestanding toolchains may ignore `main` entirely and use a target-specific entry point (toolchain-defined).

### 2.2 Declarations
Top-level items:
- `use` import
- `fn` / `unsafe fn` function
- `static` / `static mut` item
- `struct`, `enum`
- `union`
- `trait`, `impl`
- `extern` declarations (FFI)

#### 2.2.1 `use` items (imports and re-exports)
`use` brings names into scope (and may re-export them when preceded by `pub`).

Forms (normative):
- `use M;` imports module `M` as `M`.
- `use M as N;` imports module `M` as `N`.
- `use M::x;` imports `x` from module `M` (where `x` may name either an item or a submodule).
- `use M::x as y;` imports `x` from `M` as `y`.
- `use M::*;` imports all public names of module `M` into the current scope (glob import). Name collisions are a compile-time error.
- `use M { a, b, c };` is grouped-list sugar (equivalent to `use M::{a, b, c};`).
- `use M { a as b, c as d };` is grouped-list sugar with aliases.
- `pub use ...;` re-exports the imported name(s) as part of the current module’s public interface.

Rules (normative):
- A `use` item resolves modules and items within the current package or an imported package (toolchain-defined package mechanism).
- `self` and `super` may appear as the root of a `use` path, as in other paths (see §2.1 and §6 Paths).
- For `use P;` and `use P as N;`, `P` must resolve to a module. It is a compile-time error to `use`-import an item as a module.
- For `use M::x;` and `use M::x as y;`, `M` must resolve to a module. `x` must resolve to a public name of `M`.
- For `use M::*;`, `M` must resolve to a module. The import set is all public names of `M`.
- A `use` item introduces bindings in the current module scope. Introducing two bindings with the same name in the same scope is a compile-time error.

##### 2.2.1.1 Name binding and collision rules (Normative)
Definitions:
- A **binding** is a name in the current scope that refers to exactly one resolved symbol (module / function / type / etc.).
- An **explicit import** is `use util;`, `use util as U;`, `use util::x;`, or `use util::x as y;`.
- A **glob import** is `use util::*;`.
- A **local definition** is something declared in the scope (e.g. `fn x() {}`, `struct X { ... }`, `mod x { ... }`).

Rule 1: One name → one symbol (no overloading by kind)
- In a single scope, a name may bind to exactly one symbol. There is no separate “type namespace” vs “value namespace”.

Rule 2: Local definitions win (conflicts are errors)
- If the current scope defines `x`, then imports must not introduce `x`.
- If an import would introduce `x` where `x` is already locally defined, it is a compile-time error (`E0511`).

Rule 3: Explicit imports must be conflict-free
- If an explicit import would introduce a name that is already bound by:
  - a local definition,
  - another explicit import, or
  - a previously resolved glob candidate,
  then:
  - If it resolves to the exact same symbol, it is allowed (idempotent).
  - Otherwise it is a compile-time error (`E0512`). Aliasing must be used to resolve the conflict.

Rule 4: Glob imports are lazy providers, not eager binders
- A glob import does not immediately bind every name. It only provides candidates when a name is used and is not already bound by a local definition or an explicit import.
- Lookup order for an unqualified name `x` in a scope:
  1. local definitions
  2. explicit imports (including module imports like `use util;`)
  3. glob candidates
  4. error: not found
- If glob lookup produces 0 candidates: not found.
- If glob lookup produces exactly 1 candidate: bind `x` to that candidate.
- If glob lookup produces 2+ different candidates: compile-time error (`E0513`, ambiguous).
- If a glob candidate name conflicts with an already-bound name, it is ignored (no error unless the name is actually used and ambiguous).

Rule 5: Importing a module name collides like everything else
- `use util;` introduces a binding named `util`. Any attempt to bind `util` again in the same scope follows the same conflict rules.

Rule 6: Duplicate public exports inside a module are illegal
- Within a module scope, it is a compile-time error to have two public symbols with the same name (`E0514`).

### 2.3 Visibility
- Default: module-private.
- `pub` makes an item public to importing packages.
- `pub(crate)` is public within the package.
- `pub(super)` is public to the parent module only (it is invalid in the root module).
- Re-exports supported: `pub use foo::bar`.

### 2.4 Static items
`static` items define global storage with `'static` lifetime and a stable address.

Forms:
- `static NAME: T;` declares a zero-initialized immutable global.
- `static mut NAME: T;` declares a zero-initialized mutable global.
- `static NAME: T = init;` declares an immutable global with a compile-time initializer.
- `static mut NAME: T = init;` declares a mutable global with a compile-time initializer.

Initialization (normative):
- If no initializer is provided, the static is zero-initialized (all bits zero).
- If an initializer is provided, it must be a **static initializer expression** (see below) and is evaluated at compile time.

Static initializer expressions (normative):
- literals
- tuple/array/struct/union literals whose fields/elements are static initializer expressions
- `as` casts between numeric types
- `&place` where `place` is:
  - a `static` item, or
  - an `extern static` item
- `unsafe { e }` where `e` is a static initializer expression (allows `unsafe` casts, such as integer↔pointer or pointer↔pointer, when needed for FFI)

The following are not permitted in static initializer expressions (non-exhaustive):
- function calls
- control flow (`if`, `match`, loops)
- `defer`
- indexing operations

Access rules (normative):
- Reading an immutable `static` is permitted in safe code.
- Writing an immutable `static` is invalid.
- Reading from or writing to a `static mut` is permitted only in `unsafe` contexts.

Concurrency note (normative):
- In concurrent environments, unsynchronized access to `static mut` may cause data races and is undefined behavior in `unsafe` code (see §13).

## 3. Types (Normative)

### 3.1 Primitive types
Core primitives are fixed-width and C-like:
- `Bool`
- Signed integers: `I8 I16 I32 I64 I128 Isize`
- Unsigned integers: `U8 U16 U32 U64 U128 Usize`
- Floating: `F32 F64` (may be unavailable on some freestanding targets; see §11.2)
- `Char` (Unicode scalar)
- `Unit` written `()`
- `Void` (uninhabited type; used primarily for `Ptr[Void]` and unreachable code)

Aliases:
- `Int` := `Isize`
- `UInt` := `Usize`

### 3.2 Composite types
- Tuples: `(T1, T2, ...)`
- Arrays: `[T; N]` where `N` is a compile-time constant
- Structs (product types)
- Enums (tagged unions / sum types)

#### 3.2.1 Field and variant visibility
Fields of `struct`/`union` and variants of `enum` may carry a visibility modifier.

Rules (normative):
- Default visibility for fields and variants is module-private.
- `pub`, `pub(crate)`, and `pub(super)` on a field or variant use the same meaning as item visibility (§2.3).

### 3.2.1 Function types
- Function types have the form: `fn(T1, T2, ...) -> Tr`.
- A named function item can be used as a value of its corresponding function type.
- Calling a function value `f(args...)` is equivalent to calling the referenced function.

### 3.3 Pointer and slice types
- `Ptr[T]` is a raw pointer type suitable for C ABI.
  - `Ptr[T]` may be null.
  - Dereferencing, pointer arithmetic, and int↔ptr casts require `unsafe`.
- `Slice[T]` is a fat pointer `{ ptr: Ptr[T], len: Usize }` with safe indexing.

Notes:
- References (`&T`, `&mut T`) are intentionally **not** part of the v1.0 core language. APIs use `Ptr[T]` and `Slice[T]`.

### 3.4 String and byte slice aliases (Normative)
Lumen is freestanding-first, so core v1.0 uses slice-based string types rather than allocating `String` types.

Aliases (normative):
- `Bytes` := `Slice[U8]` (arbitrary bytes)
- `Str` := `Slice[U8]` with the invariant that the bytes form valid UTF‑8
- `CStr` := `Ptr[U8]` with the invariant that it points to a NUL-terminated byte sequence (a C string)

## 4. Safety Model (Normative)

### 4.1 The safety contract
- **Safe code must not have undefined behavior.**
- Operations capable of introducing undefined behavior are restricted to `unsafe` contexts.

### 4.1.1 Traps
A **trap** terminates execution immediately without unwinding. Implementations may lower a trap to an abort, a CPU trap instruction, or an equivalent mechanism.

### 4.2 Unsafe contexts
Unsafe operations are permitted only within:
- `unsafe { ... }` blocks
- `unsafe fn ...` bodies

### 4.3 Operations requiring `unsafe` (non-exhaustive)
- Dereferencing `Ptr[T]`
- Pointer arithmetic (including indexing through raw pointers)
- Casting between integers and pointers
- Calling `extern` functions, unless wrapped by a documented safe wrapper
- Volatile memory access (`core.intrinsics.volatileLoad/volatileStore`)
- Accessing a `union` field
- Accessing `@repr(packed)` fields that may be unaligned
- Inline assembly

## 5. Values, Variables, and Bindings (Normative)

### 5.1 Let bindings
- `let x = expr` introduces an immutable binding.
- `let mut x = expr` introduces a mutable binding.
- Shadowing is allowed.

### 5.2 Assignment
- Assignment requires `mut` binding.

### 5.3 Moves, copies, and drops (v1.0 policy)
- Assignments and argument passing have **value semantics**: values are copied (conceptually bitwise copy).
- No mandatory destructors exist in the core language.
- Resource management is performed via `defer` and library patterns (and explicit library calls like `close`).

(A hosted profile may add richer drop semantics; out of scope for v1.0 core.)

## 6. Expressions and Statements (Normative)

### 6.1 Expression-oriented blocks
- Blocks evaluate to the last expression (if no trailing `;`).
- Statements end with `;` and evaluate to `()`.

### 6.2 Evaluation order
- Function arguments evaluate left-to-right.
- `&&` and `||` short-circuit.
- `match` scrutinee evaluates once.

### 6.2.1 Named arguments in calls
An argument in a call may be positional (`expr`) or named (`name: expr`).

Rules (normative):
- Named arguments bind to parameters by name.
- A call may mix positional and named arguments, but once a named argument is used, all subsequent arguments must be named.
- Each parameter may be provided at most once.
- It is a compile-time error to supply a name that is not a parameter name.
- Evaluation order is left-to-right as written in the source, independent of reordering for parameter binding.

### 6.2.2 Array literals
Arrays may be constructed with:
- an element list: `[e0, e1, ..., eN]`, or
- a repeat form: `[value; count]`.

Rules (normative):
- In `[value; count]`, `value` is evaluated exactly once.
- `count` must be a compile-time constant non-negative integer. The resulting array type is `[T; count]` where `T` is the type of `value`.

### 6.3 Operators
- Arithmetic: `+ - * / %`
- Comparison: `== != < <= > >=`
- Boolean: `&& || !`
- Bitwise: `& | ^ ~ << >>`

### 6.3.3 Composite literals: struct literals
A struct literal has the form `Type { fields... }`.

Field forms (surface syntax):
- `field: expr` sets the field explicitly.
- `field` is shorthand for `field: field` (it uses the in-scope binding named `field`).
- `.. base` is a struct update initializer that supplies omitted fields from `base`.

Rules (normative):
- The `Type` in a struct literal must resolve to a `struct` type.
- If no `.. base` is present, every field of `Type` must be specified exactly once.
- If `.. base` is present:
  - `base` must have type `Type`.
  - each field explicitly listed in the literal overrides the corresponding field from `base`.
  - every field not explicitly listed is taken from `base`.
  - `.. base` must appear at most once and must be the last field initializer in the literal.
- Field initializers evaluate left-to-right as written. If `.. base` is present, `base` evaluates after all explicit field initializers.

### 6.3.4 String, bytes, and C string literals (Normative)
Lumen source files are UTF‑8 (§1.1). String and byte literals are immutable and stored in static read-only memory for the lifetime of the program.

Token kinds and codecs (normative surface contract):
- `"..."` (StringLit) decodes as `core.utf8.cooked`
- `r"..."` (RawStringLit) decodes as `core.utf8.raw`
- `b"..."` (BytesLit) decodes as `core.bytes.cooked`
- `c"..."` (CStringLit) decodes as `core.cstr.cooked_nul`

#### 6.3.4.1 Cooked UTF‑8 strings: `"..."` (`core.utf8.cooked`)
- The literal contents are a sequence of Unicode scalar values produced by interpreting escape sequences.
- The resulting scalar sequence is encoded as UTF‑8 bytes.
- The expression has type `Str` (a UTF‑8 slice).

Recognized escapes (normative):
- `\\n` (LF, U+000A), `\\r` (CR, U+000D), `\\t` (TAB, U+0009), `\\\\` (backslash), `\\\"` (double quote)
- `\\0` (NUL, U+0000)
- `\\u{HEX}` where `HEX` is 1..6 hex digits denoting a Unicode scalar value

Invalid escapes are a compile-time error.

#### 6.3.4.2 Raw UTF‑8 strings: `r"..."` (`core.utf8.raw`)
- No escape sequences are processed.
- The literal contents are interpreted as Unicode scalar values as written in the source file.
- The scalar sequence is encoded as UTF‑8 bytes.
- The expression has type `Str`.

#### 6.3.4.3 Cooked bytes: `b"..."` (`core.bytes.cooked`)
- The literal contents decode to a sequence of bytes.
- The expression has type `Bytes`.

Recognized escapes (normative):
- `\\n` (0x0A), `\\r` (0x0D), `\\t` (0x09), `\\\\` (0x5C), `\\\"` (0x22)
- `\\0` (0x00)
- `\\xNN` where `NN` are exactly 2 hex digits (byte value 0..255)

All non-escaped characters in a `b"..."` literal must be ASCII (codepoint 0x20..0x7E) excluding `"` and `\\`. Otherwise it is a compile-time error.

#### 6.3.4.4 Cooked C strings: `c"..."` (`core.cstr.cooked_nul`)
- Decode as cooked UTF‑8 (as in `"..."`), then encode to UTF‑8 bytes.
- The resulting bytes must not contain `0` (NUL) except for the implicit terminator.
- An implicit trailing NUL byte is appended.
- The expression has type `CStr`.

FFI note (normative):
- `c"..."` is intended for `extern "C"` APIs expecting a C string (`CStr`/`Ptr[U8]`). It does not allocate.

### 6.3.0 No implicit numeric conversions
- There are no implicit numeric promotions or conversions.
- Integer literals are type-inferred from context.
- If an integer literal’s type remains ambiguous after type checking, it is a compile-time error (`E0501`) with a fix-it suggesting an explicit type annotation or an `as` cast.

### 6.3.1 Integer overflow and shifts
- Integer arithmetic is defined as two’s-complement wraparound for signed and unsigned integer types.
- Shifts by an amount greater than or equal to the bit-width trap.

### 6.3.2 Division and remainder
- Division or remainder by zero trap.
- For signed division, the behavior is defined as two’s-complement truncation toward zero.

### 6.4 Pointers, address-of, dereference, and casts
- `&place` computes a raw pointer `Ptr[T]` to a place expression (`place` is a local, parameter, field, array element, or dereference).
- `&place` is permitted in safe code.
- **Place expressions** (places) are expressions that denote a storage location and may appear:
  - on the left-hand side of assignment, and/or
  - as the operand of `&`.

  The v1.0 core defines the following as places:
  - locals and parameters: `x`
  - field access: `p.field`
  - indexing into arrays and slices: `arr[i]`, `xs[i]`
  - dereference: `*ptr`

  Taking the address of a place does not evaluate the place for read/write. In particular, `&(*ptr)` does not read through `ptr`.
  (Reading or writing through `*ptr` still requires `unsafe`.)
- `*ptr` forms a place by dereferencing a raw pointer.
  - Reading or writing through a dereferenced raw pointer is permitted only in `unsafe` contexts.
- Pointer arithmetic is permitted only in `unsafe` contexts:
  - `p + n` / `p - n` where `p: Ptr[T]` and `n: Int` yields `Ptr[T]`.
  - `p1 - p2` where `p1: Ptr[T]` and `p2: Ptr[T]` yields `Isize` (element count).
  - The programmer must uphold the usual C-like invariants (same allocation/object); violations are undefined behavior in `unsafe` code.

Casts use `as`:
- `e as T` performs an explicit cast.
- Numeric casts are defined and never produce undefined behavior (they may wrap/truncate).
- Pointer↔integer casts require `unsafe`.
- Casting between pointer types (e.g. `Ptr[A]` to `Ptr[B]`) requires `unsafe` and preserves the raw address bits.

Numeric cast rules (v1.0 core):
- Integer→integer: truncates or sign-extends as needed; the result is the source value modulo `2^N` where `N` is the destination bit width.
- Integer→Bool: `0` becomes `false`, non-zero becomes `true`.
- Bool→integer: `false` becomes `0`, `true` becomes `1`.
- Float casts are defined only when `target_has_float` is true.

### 6.4 Control flow
- `if/else` is an expression.
- Loops: `while`, `for pat in expr`, `loop`
- `break`, `continue`, `return`
- `defer { ... }` registers an action that executes exactly once at scope exit (LIFO).

#### 6.4.1 `defer`
`defer { ... }` executes when exiting the innermost enclosing scope via:
- falling off the end of the block,
- `return`,
- `break`,
- `continue`.

Defers execute in **LIFO** order. A defer body runs at most once.

Defers do **not** run when control flow is terminated by a trap/abort that does not unwind (see §4.1.1).

#### 6.4.2 `for` over slices and arrays
In v1.0 core, `for pat in expr { body }` is defined only for iterating over:
- `Slice[T]`, and
- arrays `[T; N]`.

Type rule:
- If `expr` has type `Slice[T]` or `[T; N]`, the loop body is typechecked with `pat` bound to a value of type `T`.
- Otherwise, it is a type error (`E0503`).

Binding rule:
- `pat` must be an **irrefutable pattern** (see §6.5.1). If `pat` is refutable, it is a compile-time error (`E0502`) with a fix-it suggesting a `match`.

Normative desugaring (behavioral):
- For `xs: Slice[T]`:
  - `for pat in xs { body }` behaves as if lowered to:
    - `let mut i: Usize = 0; let len: Usize = xs.len; while i < len { let pat = unsafe { xs[i]! }; body; i = i + 1 }`
  - The `unsafe` in this lowering is compiler-internal and justified by the `i < len` guard; user code does not require `unsafe` to use `for` over slices.
- For `arr: [T; N]`:
  - `for pat in arr { body }` behaves as if lowered to a `while` loop over `i = 0..N`.

`break`/`continue` interact with `defer` as specified in §6.4.1 (defers in exited scopes run).

### 6.5 Pattern matching
- `match` must be exhaustive unless a wildcard `_` is present.
- Guards: `Some(x) if x > 0 => ...`

#### 6.5.1 Irrefutable patterns (for `let` and `for`)
`let pat = expr;` and `for pat in expr { ... }` require `pat` to be **irrefutable** (must match all possible values of the scrutinee type). Otherwise compilation fails with `E0502`.

The following patterns are irrefutable in v1.0 core:
- `_`
- an identifier binding (e.g. `x`)
- a parenthesized irrefutable pattern (e.g. `(x)`)
- a tuple pattern where all element patterns are irrefutable (e.g. `(x, _)`)
- a struct pattern `Type { field: pat, ..., .. }` where all specified subpatterns are irrefutable (`..` is permitted)

The following patterns are **refutable** in v1.0 core (non-exhaustive):
- literal patterns
- enum variant patterns (e.g. `Some(x)`)
- or-patterns (`p1 | p2`)

#### 6.5.2 Match exhaustiveness (v1.0 core)
Let the scrutinee have type `E`.

If `E` is an `enum` type, a `match` is exhaustive iff either:
- there is a wildcard `_` arm, or
- for every variant `V` of `E`, there exists at least one **unguarded** arm with top-level pattern matching `V`.

Guards do not contribute to exhaustiveness: an arm `V(...) if cond => ...` is treated as “maybe matches” and does not satisfy the requirement for `V`.

If `E` is not an `enum` type, a wildcard `_` arm is required for exhaustiveness in v1.0 core.
Non-exhaustive matches are a compile-time error (`E0504`).

### 6.6 Inline assembly (feature-gated) (Normative)
Inline assembly is provided as a feature-gated, compiler intrinsic expression form:

```lumen
unsafe {
  asm("template",
      in("reg") expr,
      out("reg") place,
      clobber("name"),
      options("volatile", "nomem", "readonly", "preserves_flags", "noreturn"))
}
```

Rules (normative):
- Inline assembly is permitted only in `unsafe` contexts.
- `asm(...)` is feature-gated and requires explicit enablement (toolchain-defined).
- The first argument (template) must be a string literal.
- `in("reg") expr` provides an input operand.
- `out("reg") place` provides an output operand; `place` must be a place expression.
- `clobber("name")` declares a clobbered register, or a special clobber:
  - `"memory"`: the asm may read/write arbitrary memory (compiler must treat it as a full compiler barrier for memory reordering)
  - `"cc"`: condition codes are clobbered (where applicable)
- `options(...)` must be a subset of the recognized option strings:
  - `"volatile"`: asm must not be removed or merged
  - `"nomem"`: asm does not read/write memory (unless `"memory"` clobber is also present; toolchains must reject contradictory specifications)
  - `"readonly"`: asm may read but not write memory
  - `"preserves_flags"`: asm does not modify condition codes (where applicable)
  - `"noreturn"`: asm does not return normally; the expression has type `Void`

Type rule (normative):
- If `options("noreturn")` is present, `asm(...)` has type `Void`; otherwise it has type `()`.

Portability note (normative):
- Register names, templates, and operand constraints are target-specific. Code using `asm` should be guarded with `@cfg(...)` predicates appropriate for the target.

## 7. Generics and Traits (Normative)

### 7.1 Generics are compile-time only
- Generics are **monomorphized**: generic functions and types are specialized into concrete instantiations at compile time.
- There is no runtime type information requirement.

### 7.2 Traits are compile-time constraints
- Traits declare required functions/methods.
- Trait bounds restrict generic type parameters: `fn sort[T](xs: Slice[T]) where T: Ord { ... }`
- Trait dispatch is static by default (monomorphized).

Within a trait definition and its `impl`, the identifier `Self` refers to the implementing type.

### 7.3 Impl blocks and method-call sugar
Lumen supports `impl` blocks for:
- inherent impls: `impl Type { ... }`
- trait impls: `impl Trait for Type { ... }`

Method call syntax is sugar:
- `x.f(a, b)` desugars to `Type.f(x, a, b)` only if `f` resolves as an **inherent** method for `Type`.
- Trait methods are not considered during dot-call lookup. To call a trait method, use UFCS: `Trait.f(x, a, b)`. If a dot-call would resolve only to a trait method, it is a compile-time error (`E0505`) with a fix-it suggesting UFCS.
The receiver is simply the first parameter of the function as written.

### 7.4 Coherence (orphan rule)
To keep resolution deterministic, an `impl Trait for Type` is legal only if:
- The trait is defined in the current package, or
- The type is defined in the current package.

### 7.5 No trait objects in core v1.0
`dyn Trait` / implicit vtables are out of scope for v1.0 core.
Runtime polymorphism is expressed explicitly via `@repr(C)` vtable structs and function pointers (see §10.4).

## 8. Error Handling (Normative)

### 8.1 No exceptions
Core Lumen has no exceptions and no `throws` keyword.

### 8.2 Result-based APIs
Recoverable failure is represented by a library `Result[T, E]` enum.

### 8.3 The `try` operator
`try e` is sugar for early return on error when the enclosing function returns `Result[...]`.

Normative rewrite:
- If `e` evaluates to `Ok(v)`, then `try e` evaluates to `v`.
- If `e` evaluates to `Err(err)`, then `try e` returns `Err(err)` from the current function.

If the current function’s return type is not `Result[...]`, `try` is a type error.

## 9. Slices and Indexing (Normative)

Given a value `xs: Slice[T]` and `i: Usize`:
- `xs[i]` performs a bounds check; on out-of-bounds it traps (freestanding-friendly abort/trap).
- `xs[i]?` returns `Option[T]`.
- `xs[i]!` is unchecked and is permitted only in `unsafe` contexts.

For `p: Ptr[T]`:
- `p[i]!` is permitted only in `unsafe` contexts and is sugar for `*(p + (i as Int))`.
- `p[i]` and `p[i]?` are invalid (raw pointers have no length).

## 10. Interoperability (Normative)

### 10.1 `extern "C"`
- `extern "C"` items use the platform C ABI.
- Only C-compatible types may appear in `extern "C"` signatures (see `FFI_ABI.md`).

#### 10.1.1 C varargs (`...`)
Lumen supports C variadic functions for interoperability with libc and other C APIs.

Rules (normative):
- `...` is permitted only in `extern "C"` function declarations.
- Calling an `extern "C"` function is `unsafe` (see §4.3). This includes calls to C varargs functions.
- Toolchains must not apply implicit “default argument promotions” at the Lumen language level. Instead, arguments passed to `...` must be provided in their C-ABI-promoted form.

Varargs argument type restrictions (normative):
- Each argument passed to `...` must be one of:
  - integers of at least 32 bits: `I32`, `U32`, `I64`, `U64`, `I128`, `U128`, `Isize`, `Usize`
  - pointers: `Ptr[T]` for any `T`
  - `F64` if `target_has_float` is true
- Passing any other type (including `Bool`, `I8/I16/U8/U16`, `F32`, `Slice[T]`, tuples, structs, enums) is a compile-time error (`E0506`) with a fix-it suggesting an explicit cast to an allowed promoted type.

### 10.2 Representation
Representation attributes are defined in `FFI_ABI.md`:
- `@repr(C)`
- `@repr(transparent)`
- `@repr(packed)` (unsafe to access unaligned)

### 10.2.1 Linkage and symbol names
For `extern "C"` functions and statics, symbol naming and visibility are specified by `FFI_ABI.md`.

Toolchains must support the following attributes for C interop:
- `@no_mangle` (do not apply name mangling; export/import the identifier as written)
- `@link_name("symbol")` (override the symbol name used at link time)
- `@visibility("default"|"hidden")` (control export visibility; defaults are toolchain-defined)

### 10.2.2 Alignment controls
Toolchains must support `@align(N)` on `struct` definitions and `static` declarations (when supported by the item kind), where `N` is a power of two.
`@align(N)` increases alignment to at least `N`; it must not reduce alignment below what the target ABI requires.

### 10.2.3 Unions and bitfields (FFI)
Lumen supports C-compatible unions and bitfields for interoperability.

- `@repr(C)` on a `union` defines a C-compatible union layout (see `FFI_ABI.md`).
- In `@repr(C)` structs, a field annotated `@bits(N)` is a C bitfield member of width `N` bits (see `FFI_ABI.md`).

These features are primarily intended for FFI and are not portable across targets beyond the guarantees of the platform C ABI.

### 10.3 No implicit allocation across ABI
The core language does not define an owned `String`/`Vec` type. Any such types are library-defined and must not cross the C ABI boundary unless explicitly specified as C-compatible wrappers.

### 10.4 Explicit vtables (C-friendly runtime polymorphism)
When runtime polymorphism is needed, it is expressed explicitly:
- a `@repr(C)` vtable struct containing function pointers
- a `{ ctx: Ptr[Void], vtable: Ptr[VTable] }` handle

This pattern is C ABI-compatible and auditable.

## 11. Attributes and Feature Gates (Normative)
- `@inline`, `@deprecated("msg")`, `@test`, `@cfg(...)`, `@no_mangle`, `@link_name("sym")`, `@visibility(...)`, `@align(N)`, `@bits(N)`
- Experimental features require explicit enablement.

Known experimental features (non-exhaustive):
The surface grammar (`LUMEN_EBNF.md`) includes some constructs that are present but require explicit enablement in v1.0 toolchains.
Unless otherwise specified by an Edition, the following feature names are recommended and must be treated as distinct toggles:

- `asm` — inline assembly expression form (see §6.6)
- `type_alias` — `type Name = ...;` items
- `const_item` — `const NAME: T = expr;` items
- `macros` — `macro` items and macro expansion
- `assoc_types` — associated `type` items in `trait`/`impl`
- `assoc_consts` — associated `const` items in `trait`/`impl`
- `turbofish` — postfix explicit type arguments `x.f::[T](...)`

### 11.1 `@cfg(...)`
Items annotated with `@cfg(cond)` are included only when `cond` evaluates true at compile time.
For v1.0 core, the required target predicates are:
- `target_has_float`
- `target_pointer_width = 16|32|64`
- `target_endian = "little"|"big"`
Additional recommended predicates (toolchain-defined, but widely needed for portability):
- `target_arch = "x86_64"|"aarch64"|...`
- `target_os = "linux"|"macos"|"windows"|...`

### 11.2 Floating point availability
If `target_has_float` is false, referencing `F32`/`F64` or using float literals is a compile-time error unless guarded by `@cfg(target_has_float)`.

## 12. Diagnostics (Normative)
- Every diagnostic has a stable code like `E0421`.
- Diagnostics include machine-readable fix-its when safe.

Minimum required v1.0 core diagnostics (non-exhaustive):
- `E0501` Ambiguous integer literal (add annotation or `as` cast)
- `E0502` Refutable pattern not allowed in `let`/`for` (use `match`)
- `E0503` `for` requires `Slice[T]` or `[T; N]`
- `E0504` Non-exhaustive `match` on enum
- `E0505` Dot-call resolves only inherent methods (use UFCS for trait methods)
- `E0506` Invalid C varargs argument type (cast to a promoted C ABI type)
- `E0507` Invalid static initializer (must be compile-time)
- `E0508` Access to `static mut` requires `unsafe`
- `E0509` Invalid inline asm form (unsupported options/operands)
- `E0510` Missing file module declaration (`mod name;`) for non-root source file
- `E0511` Import conflicts with local definition
- `E0512` Conflicting explicit imports (use alias)
- `E0513` Ambiguous glob import
- `E0514` Duplicate public export in module

## 13. Memory Model and Concurrency (Normative)

### 13.1 Single-threaded core
The v1.0 core language is freestanding-first and does not require threads. In a strictly single-threaded execution environment, the semantics are defined by the usual sequential evaluation rules elsewhere in this spec.

### 13.2 Data races
If an implementation provides concurrent execution (multiple threads or equivalent), the following are required:
- A **data race** occurs when two or more threads access the same memory location concurrently, at least one access is a write, and the accesses are not ordered by synchronization.
- Any data race on non-atomic memory is undefined behavior (in `unsafe` code).

### 13.3 Atomics
Atomic operations provided by the core library (`core.atomic`) are the standard mechanism for synchronization between threads.
The set of atomic types and operations is specified in `CORELIB.md`. Memory orders have their conventional meaning (`Relaxed`, `Acquire`, `Release`, `AcqRel`, `SeqCst`).

### 13.4 Volatile (MMIO)
Volatile accesses (`core.intrinsics.volatileLoad/volatileStore`) are intended for memory-mapped I/O.
They do not establish synchronization between threads and do not imply atomicity.
Volatile accesses must not be elided, merged, or reordered with respect to other volatile accesses.
No additional ordering with respect to non-volatile memory operations is implied; use `core.atomic.compilerFence`/`core.atomic.fence` or target-specific barriers (e.g., inline asm with `"memory"` clobber) when ordering is required.
