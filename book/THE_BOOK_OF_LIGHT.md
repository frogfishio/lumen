# The Book of Light

... or otherwise "Lumen Book".

TODO: write it

We can be poetic in the intro, then brutally precise everywhere else.

---

The Book of Light (Lumen Book)

0. Foreword
- What Lumen is (and is not)
- “C with hindsight” thesis
- Who this book is for (systems people, compiler people, “I like sharp tools” people)
- Design values: deterministic, explicit, low-level, capability-aware, no bullshit

1. Quickstart

1.1 Hello, world (with extern)
- extern "C" fn puts(...)
- c"..." vs b"..." vs "..." vs r"..."

1.2 Build / run mental model
- What compiling means in Lumen world (surface → AST → GL → SIR → LLVM → bin)
- Where “meaning” lives
- Why “no heisenbugs”

1.3 Your first footgun
- pointers + casts + volatile
- “unsafe is bright orange”

2. The Language

2.1 Syntax basics
- files, units/modules
- declarations order
- statements vs expressions (block expressions!)

2.2 Types
- primitives, pointers, arrays/slices
- structs/unions/enums (if applicable)
- type aliases
- function types, “fun” (if you expose it)

2.3 Values & literals
- ints (bases, suffixes)
- floats
- chars
- strings/bytes/cstr rules
- exact encoding commitments (UTF-8 default)

2.4 Control flow
- if / match / switch
- loops (while/loop/for-in if present)
- break/continue/return
- defer + scope exit semantics (LIFO, exit paths)

2.5 Functions
- calling, params, return
- extern ABI + link name
- visibility/linkage (public/local)

2.6 Unsafe & capabilities
- what “unsafe” means in Lumen
- capability model (zABI caps)
- what is checked vs what is merely annotated
- patterns for “capability-gated modules”

3. The Machine Contract

This is where you flex. Make it readable, not mystical.

3.1 zABI
- what it is
- why it exists (modular host-managed “stdlib”)
- capability attachment model (tcp, fileio, alloc/free, etc.)
- ABI stability story (IDs, names, versions)

3.2 Memory model (practical)
- what the compiler assumes / does not assume
- volatile loads/stores
- aliasing expectations (if any)
- “what Lumen promises the machine”

3.3 Syscalls (future chapter placeholder)
- “semantic syscalls” idea
- cross-platform mapping principles

4. The Compiler You Can Read

This is the chapter that makes people go: “wait… what?”

4.1 Grit: the compiler generator
- spec → pack → monomorphized compiler
- what grit evolve does
- what gritc does
- closed-world compilation rule

4.2 Why classic compilers rot
- CST→AST = language semantics
- MIR = system semantics
- “your semantics leak into MIR” problem
- why “entropy generator” happens

4.3 GL: the semantic language (not a normal AST)
- what survives and why
- “semantic atoms” vs “parse scaffolding”
- tiering (A/B/C) as an ABI strategy
- strict boundary invariants

4.4 SIR: the lowering target
- JSONL vs sugared SIR
- IDs are ephemeral (why injection requires it)
- “patching the compiler stream” concept
- how SIR relates to LLVM IR (and why it’s nicer)

5. The Lumen Standard Library (or: “What counts as stdlib here?”)
- what is in-language vs what is zABI-provided
- recommended conventions
- philosophy: “tight, modular, host-managed”

6. Cookbook (Real code)
- FFI patterns
- defer patterns (nested unsafe, nested defers)
- pointer/int casts safely-ish
- struct packing and layout attributes
- common pitfalls

7. Appendix

A. Lexing / parsing notes
- why LALR + Earley fallback exists
- trivia rules
- module resolution overview

B. Encodings spec
- literal → bytes mapping
- raw vs cooked
- CStr null-termination rule

C. IR views
- a single program shown as:
- Lumen source
- AST JSON
- GL strict artifact
- SIR sugared
- LLVM IR (optional)
- a mini “Rosetta Stone” table

D. Glossary
- strict boundary, committed semantics, capability, fold-away, semantic atom, etc.

---

Two strong moves to keep in mind:

1. Every chapter ends with “What the compiler commits.”
A tiny box that says what is guaranteed, what is lowering intent, what is undefined/host-defined.
	
2. Keep a “normative vs non-normative” style.
Normative: MUST/SHALL rules, crisp.
Notes: “why”, “implementation hint”, “here’s the trick”.
