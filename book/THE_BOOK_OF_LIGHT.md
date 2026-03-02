# The Book of Light

*A practical guide to programming in Lumen — and understanding what the compiler commits.*

> **Status:** Draft. This book is intentionally opinionated and action-oriented. Where details are still evolving, we’ll mark them explicitly.

---

## How to read this book

This book has two voices:

- **Tutorial (non‑normative):** examples, patterns, “do this, not that.”
- **What the compiler commits (normative-ish):** the precise guarantees and the edges.

If you just want to *use* Lumen, follow the tutorial flow. If you’re implementing tooling or doing deep systems work, don’t skip the “commits” boxes.

### Conventions

- **MUST / SHALL**: intended as language guarantees.
- **SHOULD**: strong guidance; there may be exceptions.
- **MAY**: optional behavior or convenience.
- **Host-defined**: depends on the platform/runtime integration (zABI, etc.).

---

## 0. Foreword

### 0.1 What Lumen is (and is not)

Lumen is a systems language for people who want:

- **Determinism:** fewer spooky-action-at-a-distance semantics.
- **Explicitness:** sharp tools, labeled clearly.
- **Low-level control:** when you ask for bytes and pointers, you get bytes and pointers.
- **Capability-aware execution:** resources and privileged operations are surfaced and constrained.

Lumen is *not* trying to be:

- A “batteries included” environment that hides the platform.
- A language where you can ignore memory, IO, or failure.
- A magical compiler that guesses intent.

### 0.2 “C with hindsight”

If C was the first draft of portable systems programming, Lumen is the second draft — still small, still close to the machine, but with:

- clearer semantics
- better surface tooling for correctness (patterns, `match`, scoped cleanup)
- an explicit boundary between *syntax you write* and *meaning the compiler commits*

### 0.3 Who this book is for

- Systems programmers
- Compiler/tooling people
- “I like sharp tools” people

You’ll be happiest here if you prefer:

- explicit control flow
- a small set of core constructs
- reading specs *only when needed*

---

## 1. Quickstart

### 1.0 Lumen at a glance

A Lumen file is a **unit**. Units may optionally name themselves with a `mod` header, and they contain a list of top-level **items**.

Most of the time you’ll write:

- `fn` for functions
- `let` for bindings
- `if` / `match` for branching
- `while` / `loop` / `for` for repetition
- `defer` / `with (...) defer ...` for scoped cleanup
- `struct` / `enum` for data
- `use` / `mod` for namespacing

A tiny cheat sheet of shapes (details later):

- Function: `fn name(args...) -> Type { ... }`
- Binding: `let pat: Type = expr;`
- Match: `match expr { pat => expr, _ => expr }`
- Defer: `defer { ... }` or `defer cleanup(x);`
- With-defer: `with (x = acquire()) defer cleanup(x) { ... }`

> **Note:** The early chapters avoid depending on a full standard library. We’ll start with pure computation, then add IO via `extern` once the shapes are familiar.

This chapter gets you to “I can build and run code” with minimal ceremony.

### 1.1 Hello, world (with `extern`)

We’ll start with the smallest program that produces output using a C ABI function.

Topics:

- `extern "C" fn puts(...)`
- literal forms: `"..."` vs `r"..."` vs `b"..."` vs `c"..."` 

**What the compiler commits**

- Literal encoding commitments (UTF‑8 by default)
- `c"..."` NUL-termination rules
- `extern` ABI string meaning and where it matters

### 1.2 The build/run mental model

Lumen compilation is a pipeline. You don’t need to memorize every stage, but you should know where meaning gets locked in.

A useful mental model:

- **Surface** → parse
- **AST / GL** → committed semantics
- **SIR / LLVM** → lowering and codegen

**What the compiler commits**

- Which stages are semantics-bearing
- Which rewrites are definitional (sugar) vs optimization

### 1.3 Your first footgun (and how to survive it)

We intentionally show one sharp edge early:

- pointers + casts
- “unsafe is bright orange”

**What the compiler commits**

- What `unsafe { ... }` means (and what it does *not* mean)
- What is checked vs merely annotated

---

## 2. Programming in Lumen

This is the main tutorial section. Each chapter introduces one idea and ends with a small, real program.

### 2.1 Files, units, and modules

Topics:

- file structure, `mod` headers
- `mod name { ... }` inline modules
- `use` and import trees (`use M::{a, b as c}`)

Common patterns:

- public API modules
- local-only internal modules

**What the compiler commits**

- Module name resolution rules
- Import tree structure and aliasing

### 2.2 Expressions, operators, and precedence

Topics:

- literals (ints/hex/reals/chars/strings/bytes/cstr)
- unary ops (`! - ~ & * try`)
- binary precedence ladder
- postfix chains (field/index/call)

**What the compiler commits**

- Operator precedence/associativity
- Short-circuiting for `&&` / `||`

### 2.3 Blocks are expressions

Lumen treats blocks as expressions:

- last expression becomes the block value
- `let x = { ... };` is normal

**What the compiler commits**

- Statement vs expression boundaries
- Semicolon rules inside blocks

### 2.4 Variables and binding

Topics:

- `let` bindings
- discard evaluation: `let _ = expr;`
- patterns in bindings (teaser; full patterns later)

**What the compiler commits**

- Binding forms and where types attach

### 2.6 Match and patterns

Topics:

- `match` expressions
- match arms and optional guards
- pattern forms: `_`, bind, tuple, ctor, struct, `..`

Practical examples:

- tiny parser
- command dispatch

**What the compiler commits**

- Pattern disambiguation rules
- Arm selection and guard evaluation order

Many Lumen constructs (including `if let` and `while let`) are easiest to understand once `match` and patterns feel natural, so we learn them early.

### 2.5 Control flow

Topics:

- `if / else`
- `while`, `loop`, `for`
- `break`, `continue`, `return`

**What the compiler commits**

- Control-flow node semantics
- Loop forms and lowering intent

### 2.7 Sugar that buys readability

Lumen has a few pieces of definitional sugar. Learn them as “spelling,” not as new semantics:

- `if let ...` (defined in terms of `match`)
- `while let ...` (defined in terms of `loop + match`)
- `guard cond else { ... }` (defined in terms of `if`)

**What the compiler commits**

- **Defined as desugaring:** `if let` is equivalent to a `match` with a wildcard fallthrough arm
- **Defined as desugaring:** `while let` is equivalent to a `loop` containing a `match` that breaks on `_`
- **Defined as desugaring:** `guard cond else { ... }` is equivalent to `if cond { } else { ... }`

### 2.8 Scoped cleanup: `defer` and `with ... defer ...`

Topics:

- `defer { ... }`
- `defer expr;` sugar
- `with (x = acquire()) defer cleanup(x) { ... }`

Practical examples:

- file handle wrapper
- temporary buffer management

**What the compiler commits**

- **Guaranteed:** deferred cleanups run in LIFO order within a scope
- **Defined as desugaring:** `with (...) defer ... { body }` is equivalent to a block containing the binding, a `defer`, then `body`
- **Unspecified / evolving:** the exact set of exit paths that trigger cleanup beyond normal flow (e.g. traps) may change

### 2.9 User-defined types

Topics:

- `struct`, `union`, `enum`
- struct literals: `T { a: 1, b: 2 }`
- enum variants: unit/tuple/struct variants

**What the compiler commits**

- Type names, variant shapes
- Layout notes (what is guaranteed vs target/ABI-defined)

### 2.10 Types in the large

Topics:

- type syntax: function types, tuple types, array types
- `sizeof(T)` / `alignof(T)`
- casts: `x as T`

**What the compiler commits**

- Conversion rules for `as`
- Compile-time queries behavior

### 2.x Errors, diagnostics, and traps

Lumen distinguishes between:

- **compile-time errors** (the program is rejected)
- **runtime traps** (the program aborts execution)
- **recoverable failure** (spelled in libraries / conventions)

The standard assertions map to traps:

- `assert(...)` is for user-facing validation
- `invariant(...)` is for “this should never happen” internal logic
- `assert!(...)` is a static assertion (compile-time)

**What the compiler commits**

- `assert(...)` and `invariant(...)` lower to a conditional `trap(...)` on failure
- `assert!(...)` is evaluated at compile time (when possible) and may reject the program
- The exact shape and payload of diagnostics is not part of the language contract (yet)

### 2.11 Generics (explicit, by design)

Topics:

- type application: `Box[i32]`
- explicit generic calls: `f@<T, U>(...)`

**What the compiler commits**

- Where type arguments attach
- Instantiation/monomorphization expectations (if applicable)

### 2.12 FFI and `extern`

Topics:

- `extern "C" fn ...`
- link names
- varargs (if present)

**What the compiler commits**

- ABI string meaning
- Host-defined behavior boundaries

### 2.13 Unsafe and capabilities

Topics:

- `unsafe { ... }`
- capability-gated modules

**What the compiler commits**

- What “unsafe” means
- What the compiler checks vs what is contract-only

---

## 3. The Machine Contract

This section is for people who want the “what does Lumen promise the machine?” story.

> **Draft / moving target:** this chapter documents current intent. Anything not explicitly marked as guaranteed may change between releases.

### 3.1 zABI (overview)

- what it is
- why it exists (host-managed standard library)
- capability attachment model
- stability story

### 3.2 Memory model (practical)

- what the compiler assumes / does not assume
- volatile loads/stores
- aliasing expectations (if any)

### 3.3 Syscalls (placeholder)

- semantic syscalls idea
- mapping principles

---

## 5. Standard Library (and what counts as “stdlib” here)

- in-language vs zABI-provided
- conventions
- philosophy: tight, modular, host-managed

---

## 6. Cookbook (real code)

Short, focused recipes:

- FFI patterns
- `defer` patterns (nested unsafe, nested defers)
- pointer/int casts safely-ish
- struct packing/layout notes
- common pitfalls

---

## 7. Appendix

### A. Syntax quick reference

- keywords
- statement forms
- operator precedence

### B. Literal encodings

- literal → bytes mapping
- raw vs cooked strings
- `c"..."` NUL termination

### C. IR views (Rosetta Stone)

One small program shown as:

- Lumen source
- AST JSON
- GL strict artifact
- SIR sugared
- LLVM IR (optional)

### D. Glossary

- strict boundary
- committed semantics
- capability
- fold-away
- semantic atom

---

## Two guiding moves (keep these)

1) **End every chapter with “What the compiler commits.”**

A small box listing:

- what is guaranteed
- what is intentional lowering
- what is unspecified / host-defined

2) **Keep normative vs non-normative clearly separated.**

- Tutorial prose explains “why.”
- The “commits” box explains “what.”

---

## TODO checklist (to make this draft actionable)

- [ ] Decide the canonical “Hello, world” example and the simplest printing path
- [ ] Confirm the precise `defer` exit-path semantics (return/break/panic/trap)
- [ ] Write a 1-page operator precedence table
- [ ] Add one complete end-to-end example per tutorial chapter
- [ ] Add exercises to Chapters 1–2 (K&R style)

---
# The Book of Light

*A tutorial-style guide to programming in Lumen, in the spirit of K&R.*

> **Status:** Draft. This is the **user book**. It teaches the language by building programs. Formal/IR implementation notes belong elsewhere.

---

## Preface

Lumen is a small-core, sharp-edged systems language. This book is written for people who learn best by reading short explanations and then writing code.

You should read it with a compiler nearby.

### Notation

- Code is shown in fixed-width blocks.
- “Exercises” are meant to be done; they’re part of the book.
- When we say **guarantees**, we mean behavior Lumen commits to (not optimizer accidents).

---

## Contents

1. **A Tutorial Introduction**
2. **Types, Values, and Operators**
3. **Control Flow**
4. **Functions and Program Structure**
5. **User-Defined Types: `struct`, `enum`, `union`**
6. **Pointers, `unsafe`, and `extern`**
7. **Pattern Matching**
8. **Scoped Cleanup with `defer` and `with`**
9. **Generics (Explicit by Design)**
10. **Modules and Imports**
11. **Assertions, Traps, and Error Conventions**
12. **A Larger Program**

Appendix A: Syntax Quick Reference

Appendix B: Operator Precedence

Appendix C: Literal Forms and Encodings

Appendix D: Glossary

---

## 1. A Tutorial Introduction

This chapter gets you compiling and running code, then immediately writing small programs.

### 1.1 The smallest program

Show the smallest complete Lumen file and what counts as an entry point.

### 1.2 A first real program: a table

We’ll build a tiny program that prints a conversion table (temperature, bytes-to-kib, anything) to force:

- numeric literals
- arithmetic
- a loop
- formatting/output

### 1.3 Variables and `let`

- `let name = expr;`
- `let pat: Type = expr;`
- `let _ = expr;` (evaluate and discard)

### 1.4 Blocks are expressions

Lumen blocks produce values:

- `let x = { ... };`
- last expression is the block value

### Exercises

1. Modify the table program to change step size and range.
2. Write a second table (e.g., hex → decimal) using the same structure.
3. Write a program that counts from 1 to 100 and prints only multiples of 7.

---

## 2. Types, Values, and Operators

### 2.1 Values and literal forms

- integers: decimal, hex
- reals
- booleans
- chars
- strings, raw strings
- bytes literals
- C strings

### 2.2 Type syntax (the bits you need early)

- names (`i64`, `bool`, etc.)
- tuples `(T1, T2)`
- arrays `[T; N]`
- function types `fn(T1, T2) -> R`

### 2.3 Operators and precedence

- unary: `! - ~ & * try`
- binary: arithmetic, bitwise, comparisons, short-circuit `&&`/`||`
- postfix: field/index/call

### 2.4 Casts

- `x as T`

### Exercises

1. Write `min(a, b)` and `max(a, b)` using comparisons.
2. Implement integer power `pow(base, exp)` without using floating point.
3. Write a bit-twiddling function: set, clear, and test a bit in an integer.

---

## 3. Control Flow

### 3.1 `if` and `else`

- `if cond { ... } else { ... }`

### 3.2 Loops

- `while cond stmt`
- `loop stmt`
- `for (...)` forms (as supported)

### 3.3 `break`, `continue`, `return`

### Exercises

1. Write a loop that finds the first prime larger than 10,000.
2. Write a program that computes gcd (Euclid) using a loop.
3. Write a simple “guessing” loop that terminates based on a condition.

---

## 4. Functions and Program Structure

### 4.1 Defining functions

- parameters
- return types
- local declarations

### 4.2 Scope and name lookup (practical)

- block scope
- shadowing (if allowed)

### 4.3 Declarations vs expressions

- common mistakes around semicolons

### Exercises

1. Write `abs`, `clamp`, and `lerp`.
2. Write a small library file and use it from a main file.

---

## 5. User-Defined Types: `struct`, `enum`, `union`

### 5.1 `struct` and struct literals

- definition
- construction: `T { field: expr, ... }`
- field selection

### 5.2 `enum` and variants

- unit variants
- tuple variants
- struct variants

### 5.3 `union` (when you must)

### Exercises

1. Implement a tiny `Option[T]`-like enum and write helpers.
2. Build a `Vec2 { x: f64, y: f64 }` with a couple functions.

---

## 6. Pointers, `unsafe`, and `extern`

This chapter is where Lumen becomes a systems language.

### 6.1 Address-of and dereference

- `&expr`
- `*expr`

### 6.2 `unsafe { ... }`

What it means in practice: you’re taking responsibility for invariants the compiler can’t prove.

### 6.3 Calling into C with `extern`

- `extern "C" fn ...`
- C strings
- link names

### Exercises

1. Write a wrapper around `puts`.
2. Write a safe-ish helper for working with `c"..."` values.

---

## 7. Pattern Matching

### 7.1 `match`

- arms
- optional guards

### 7.2 Patterns

- `_`
- bind patterns
- tuple patterns
- ctor patterns
- struct patterns, including `..`

### 7.3 Sugar

- `if let`
- `while let`
- `guard cond else { ... }`

### Exercises

1. Write a small expression evaluator using `enum` + `match`.
2. Parse a tiny command language (two or three commands) and dispatch with `match`.

---

## 8. Scoped Cleanup with `defer` and `with`

### 8.1 `defer { ... }`

### 8.2 `defer expr;` sugar

### 8.3 `with (x = acquire()) defer cleanup(x) { ... }`

### Exercises

1. Implement a resource handle type and ensure cleanup happens even with early return.
2. Nest two `defer`s and verify the order.

---

## 9. Generics (Explicit by Design)

### 9.1 Type application

- `Box[i32]`

### 9.2 Explicit generic calls

- `f@<T, U>(...)`

### Exercises

1. Implement `Box[T]` and write `map`-like helper (even if it’s manual).
2. Write a generic `swap[T]`.

---

## 10. Modules and Imports

### 10.1 Units and `mod`

- `mod name;`
- inline `mod name { ... }`

### 10.2 `use` and import trees

- `use path;`
- `use path as Name;`
- `use M::{a, b as c}`
- glob imports

### Exercises

1. Create a `math` module and re-export a small API surface.
2. Write a program that uses grouped imports cleanly.

---

## 11. Assertions, Traps, and Error Conventions

### 11.1 Assertions

- `assert(cond, msg?)`
- `invariant(cond, msg?)`
- `assert!(...)`

### 11.2 Traps vs errors

- compile-time rejection vs runtime abort
- recoverable failure lives in libraries/conventions

### Exercises

1. Add `assert` checks to earlier programs to validate assumptions.
2. Write a function that returns an enum error code instead of trapping.

---

## 12. A Larger Program

We’ll build one program that uses most of the language:

- data types
- parsing or text processing
- pattern matching
- scoped cleanup
- a small module structure

(Think: `wc`, `grep-lite`, a tiny JSON-ish parser, or a mini interpreter.)

### Exercises

1. Extend the program with one new command/flag.
2. Add tests (if the project has a test harness).

---

# Appendix A: Syntax Quick Reference

*(A one-page summary of the surface forms introduced in the tutorial.)*

# Appendix B: Operator Precedence

*(A precedence table matching the implementation.)*

# Appendix C: Literal Forms and Encodings

*(String vs raw string vs bytes vs C string; what gets committed.)*

# Appendix D: Glossary

*(Unit, item, pattern, arm, trap, unsafe, etc.)*

---