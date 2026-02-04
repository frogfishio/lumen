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
 struct enum trait impl use as pub
 try defer
 true false
 self super
 extern static unsafe
 in`

Contextual keywords (not reserved in all positions): `where`, `type`, `const`, `macro`, `test`.

### 1.5 Literals
- Integers: `123`, `0xFF`, `0b1010`, `_` separators allowed.
- Floats: `1.0`, `1e-3` (floating point is optional in some freestanding targets; see §3.1).
- Strings: `"..."` with escapes (owned string types are library-defined).
- Bytes: `b"..."`, byte literals `0x2A`.
- Rune/char: `'a'`, `'\n'` (Unicode scalar value).

## 2. Program Structure (Normative)

### 2.1 Modules and files
- Each file is a module.
- The package defines a module tree with a root module (`main` for binaries, `lib` for libraries).

### 2.2 Declarations
Top-level items:
- `use` import
- `fn` / `unsafe fn` function
- `struct`, `enum`
- `trait`, `impl`
- `extern` declarations (FFI)
- `type` alias, `const` (feature-gated)

### 2.3 Visibility
- Default: module-private.
- `pub` makes an item public to importing packages.
- `pub(crate)` is public within the package.
- Re-exports supported: `pub use foo::bar`.

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

### 6.3 Operators
- Arithmetic: `+ - * / %`
- Comparison: `== != < <= > >=`
- Boolean: `&& || !`
- Bitwise: `& | ^ ~ << >>`

### 6.3.0 No implicit numeric conversions
- There are no implicit numeric promotions or conversions.
- Integer literals are type-inferred from context; if ambiguous, a defaulting rule may apply (implementation-defined) or an annotation is required.

### 6.3.1 Integer overflow and shifts
- Integer arithmetic is defined as two’s-complement wraparound for signed and unsigned integer types.
- Shifts by an amount greater than or equal to the bit-width trap.

### 6.3.2 Division and remainder
- Division or remainder by zero trap.
- For signed division, the behavior is defined as two’s-complement truncation toward zero.

### 6.4 Pointers, address-of, dereference, and casts
- `&place` computes a raw pointer `Ptr[T]` to a place expression (`place` is a local, parameter, field, array element, or dereference).
  - `&place` is permitted only in `unsafe` contexts.
- `*ptr` dereferences a raw pointer.
  - Dereference is permitted only in `unsafe` contexts.
- Pointer arithmetic is permitted only in `unsafe` contexts:
  - `p + n` / `p - n` where `p: Ptr[T]` and `n: Int` yields `Ptr[T]`.
  - `p1 - p2` where `p1: Ptr[T]` and `p2: Ptr[T]` yields `Isize` (element count).
  - The programmer must uphold the usual C-like invariants (same allocation/object); violations are undefined behavior in `unsafe` code.

Casts use `as`:
- `e as T` performs an explicit cast.
- Numeric casts are defined and never produce undefined behavior (they may wrap/truncate).
- Pointer↔integer casts require `unsafe`.

Numeric cast rules (v1.0 core):
- Integer→integer: truncates or sign-extends as needed; the result is the source value modulo `2^N` where `N` is the destination bit width.
- Integer→Bool: `0` becomes `false`, non-zero becomes `true`.
- Bool→integer: `false` becomes `0`, `true` becomes `1`.
- Float casts are defined only when `target_has_float` is true.

### 6.4 Control flow
- `if/else` is an expression.
- Loops: `while`, `for x in iter`, `loop`
- `break`, `continue`, `return`
- `defer { ... }` executes at scope exit (LIFO), including on early return.

### 6.5 Pattern matching
- `match` must be exhaustive unless a wildcard `_` is present.
- Guards: `Some(x) if x > 0 => ...`

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
- `x.f(a, b)` desugars to `Type.f(x, a, b)` if `f` resolves as a method for `Type` (inherent or via trait bounds).
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

### 10.2 Representation
Representation attributes are defined in `FFI_ABI.md`:
- `@repr(C)`
- `@repr(transparent)`
- `@repr(packed)` (unsafe to access unaligned)

### 10.3 No implicit allocation across ABI
The core language does not define an owned `String`/`Vec` type. Any such types are library-defined and must not cross the C ABI boundary unless explicitly specified as C-compatible wrappers.

### 10.4 Explicit vtables (C-friendly runtime polymorphism)
When runtime polymorphism is needed, it is expressed explicitly:
- a `@repr(C)` vtable struct containing function pointers
- a `{ ctx: Ptr[Void], vtable: Ptr[VTable] }` handle

This pattern is C ABI-compatible and auditable.

## 11. Attributes and Feature Gates (Normative)
- `@inline`, `@deprecated("msg")`, `@test`, `@cfg(...)`
- Experimental features require explicit enablement.

### 11.1 `@cfg(...)`
Items annotated with `@cfg(cond)` are included only when `cond` evaluates true at compile time.
For v1.0 core, the required target predicates are:
- `target_has_float`
- `target_pointer_width = 16|32|64`
- `target_endian = "little"|"big"`

### 11.2 Floating point availability
If `target_has_float` is false, referencing `F32`/`F64` or using float literals is a compile-time error unless guarded by `@cfg(target_has_float)`.

## 12. Diagnostics (Normative)
- Every diagnostic has a stable code like `E0421`.
- Diagnostics include machine-readable fix-its when safe.
