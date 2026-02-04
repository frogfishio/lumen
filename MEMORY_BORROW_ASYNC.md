# Lumen Memory Model, Borrowing, Lifetimes, and `await` Restrictions (v0.9-draft)

> **Note:** This document describes Lumen’s earlier v0.9 direction (borrows + async restrictions + runtime-managed references). It is **not** part of the v1.0 “new C” core language spec in `SPEC.md`. Kept as design notes for a possible future hosted profile.

> **Status:** Draft-but-precise. Intended as a normative chapter for `SPEC.md`.  
> **Goal:** Provide Rust-grade aliasing safety for borrows *where used*, while keeping Lumen ergonomic with an automatic-memory default.  
> **Key idea:** Lumen has (1) automatic memory management for heap objects, and (2) a **static borrow checker** for `&T` / `&mut T` that enforces aliasing and lifetime rules.  
> **Async interaction:** Borrows cannot outlive suspension points unless proven safe; the rules below are exact.

---

## 1. Memory Model Overview (Normative)

### 1.1 Storage classes
Lumen values may reside in:
- **Stack**: local value types and temporaries (conceptual; optimizer may transform).
- **Heap**: runtime-managed objects (e.g., `String`, `Vec[T]`, `Map[K,V]`, `Ref[T]` allocations).
- **Static**: compile-time constants and `'static` data.
- **Region arenas** *(feature-gated but recommended)*: scoped allocation arenas created by `region { ... }`.

### 1.2 Value vs reference types
- **Value types** (e.g., user `struct` by default) have value semantics; moves/copies are defined by type properties.
- **Reference types** are library/runtime-managed heap objects accessed via value handles (e.g., `String`, `Vec[T]`).
  - Holding a `Vec[T]` value is holding a handle to a heap object; mutating it is mutating that object.

### 1.3 Moves, copies, and drops
- A type is **Copy** if assignment/binding copies bits (as if by value) and does not invalidate the source.
- Non-Copy values are **moved** by default (source becomes unusable).
- **Drop**: types may define destruction (finalizers) that run at end-of-scope or when a value is overwritten/moved from.
- The compiler enforces that a moved-from binding is not read again.

(Exact Copy/Drop derivation rules are specified in the stdlib/traits chapter; this chapter focuses on references/borrows.)

---

## 2. References, Borrows, and Lifetimes (Normative)

### 2.1 Reference forms
- `&T` : shared (immutable) reference
- `&mut T` : exclusive (mutable) reference
- `Ptr[T]` : raw pointer (unsafe to dereference)

### 2.2 Lifetime
A **lifetime** is a compile-time approximation of the span of program execution during which a reference is valid.
We denote lifetimes by `'a`, `'b`, etc.

- Every reference type has an associated lifetime: `&'a T`, `&'a mut T`.
- If elided, lifetimes are inferred (see §2.6).

### 2.3 Provenance (what a reference points to)
A reference points to a **place** (an lvalue), e.g.:
- a local variable
- a struct field
- an array element
- a dereference of another reference

The borrow checker tracks which place each reference is derived from.

### 2.4 Aliasing rule (the core safety invariant)
For any place `p`, during any program point:
- You may have **any number** of active shared borrows `&p` **or**
- You may have **exactly one** active mutable borrow `&mut p`,
- but **not both**.

This is the **exclusion** rule. Violations are compile-time errors.

### 2.5 Reborrowing (derived references)
From a reference, you can derive a shorter-lived reference:
- From `&'a mut T` you may create:
  - `&'b mut T` (exclusive) for some `'b ⊆ 'a`
  - `&'b T` (shared) for some `'b ⊆ 'a`
- From `&'a T` you may create `&'b T` with `'b ⊆ 'a`.

A reborrow **temporarily** restricts use of the parent reference for the duration of the child borrow (see §3.4).

### 2.6 Lifetime elision (inference)
Lumen uses deterministic elision rules for function signatures:
1. Each elided input reference gets its own lifetime parameter.
2. If there is exactly one input lifetime, it is assigned to all elided output lifetimes.
3. Otherwise, output lifetimes must be explicit.

Example:
- `fn first(xs: &Vec[Int]) -> &Int` desugars to `fn first<'a>(xs: &'a Vec[Int]) -> &'a Int`
- `fn pick(a: &Int, b: &Int) -> &Int` is **illegal** without explicit lifetimes.

---

## 3. Borrow Checking on Places (Normative)

### 3.1 Places and projections
A **place** is a base with zero or more projections:
- base: local `x`, parameter `p`, or deref `*r`
- projections: `.field`, `[index]`

We write places like: `x`, `x.f`, `x[i]`, `(*r).f`.

### 3.2 Loans and loan sets
The borrow checker models each borrow as a **loan**:
- `Loan(kind, place, region)` where `kind ∈ {Shared, Mut}` and `region` is the lifetime.

At each program point, there is an active **loan set** `L`.

### 3.3 Conflict relation
Two loans conflict if they refer to overlapping places and at least one is mutable:
- `conflict(Shared p, Shared q)` is false (no conflict)
- `conflict(Mut p, Shared q)` true if `overlap(p,q)`
- `conflict(Mut p, Mut q)` true if `overlap(p,q)`
- `conflict(Shared p, Mut q)` true if `overlap(p,q)`

**Overlap** is determined by syntactic place projection:
- Different fields of the same struct are non-overlapping (field-disjointness), unless a `union` feature exists (not in v0.9).
- Different indices of arrays/slices are treated as overlapping unless proven distinct (v0.9 is conservative: assumes overlap).

### 3.4 Use rules while a loan is active
- While `&mut p` is active, `p` and any overlapping place cannot be read or written except through that `&mut` reference.
- While `&p` is active, `p` cannot be mutably accessed (written) until the shared borrows end.

### 3.5 Non-lexical lifetimes (NLL) are required
A borrow's lifetime ends at the **last use** of the reference, not necessarily at the end of the enclosing block,
provided this does not violate safety.

Normative requirement:
- The compiler must compute borrow regions using a control-flow graph analysis that can end loans early (NLL).

### 3.6 Two-phase borrows (optional; v0.9 requires for method-call ergonomics)
To support patterns like `v.push(v.len())`, Lumen uses **two-phase** borrowing for certain `&mut self` method calls:
- Phase 1 (reservation): a mutable borrow is reserved but not activated until the call actually needs it.
- Phase 2 (activation): becomes an active `&mut` loan at the call boundary.

Rule:
- Two-phase borrowing is allowed only for compiler-known patterns (method receiver borrows) and must not allow aliasing violations.
If an implementation cannot support two-phase borrowing, it must reject such programs (but then the official compiler must support it).

---

## 4. Lifetimes as Regions (Normative)

### 4.1 Region containment
We write `'b ⊆ 'a` meaning `'b` is contained within `'a` (i.e., shorter or equal).

### 4.2 Outlives constraints
Constraint `'a : 'b` means `'a` outlives `'b` (equivalently `'b ⊆ 'a`).

### 4.3 Subtyping for references
- `&'a T` is covariant in `'a` and in `T` (when `T` is covariant; v0.9 treats all `&T` as covariant in T).
- `&'a mut T` is invariant in `T` (standard rule) and covariant in `'a`.

---

## 5. Exact `await` Restrictions (Normative)

### 5.1 Suspension points
An expression `await e` introduces a **suspension point**. The compiler transforms an `async` function into a state machine.
At a suspension point, the function may:
- suspend and later resume,
- be cancelled,
- be moved in memory by the runtime (implementation dependent).

Therefore, references to stack locals cannot safely be held across `await` unless they are stored in the state machine in a safe way.

### 5.2 The rule (precise)
Let `await` occur at program point `P` inside an `async` function.

**Rule A (No live borrow across await):**  
At any `await` point `P`, the set of active loans `L(P)` must be empty for any loan whose **borrowed place is not `static`**.

Equivalently:
- If a reference `r: &'a T` or `&'a mut T` is **live** at `P` (i.e., may be used after P on some path), then the place it points to must be:
  - `'static`, or
  - stored in a runtime-managed heap object whose access is mediated by owning handles (not a direct `&` borrow), or
  - a field of the async state machine that is itself owned and pinned per §5.4 (see exceptions).

In v0.9, Lumen adopts a simpler, enforceable rule:

**Rule A' (v0.9 enforceable):**  
No `&` or `&mut` reference whose lifetime is not `'static` may be live across `await`.

This is exactly: if `r` is used after an `await`, then `r` must have type `&'static T` (or `&'static mut T`, rare and typically unsafe).

### 5.3 How to satisfy the rule
To use data across await, you must:
1. **Own it** (move the value into the async task/state), or
2. Use a runtime-managed shared handle (`Ref[T]`, `Arc[T]`-like) and clone the handle, or
3. Re-borrow only within a scope that ends before `await`.

Examples (normative behavior):

**Rejected**
```lumen
fn f() async io {
  let mut v = Vec[Int]()
  let r = &v
  await sleep(1)      // ERROR: r is live across await
  print(r.len())
}
```

**Accepted (reborrow ends before await)**
```lumen
fn f() async io {
  let mut v = Vec[Int]()
  {
    let r = &v
    print(r.len())
  }                   // r's loan ends here (NLL)
  await sleep(1)      // OK
  v.push(1)
}
```

**Accepted (move ownership)**
```lumen
fn f() async io {
  let v = Vec[Int]()
  await useOwned(v)   // v moved into awaited call/state
}
```

**Accepted (heap handle)**
```lumen
fn f() async io {
  let v = Ref.new(Vec[Int]())
  let v2 = v.clone()
  await sleep(1)
  v2.get().push(1)    // (requires runtime sync rules; see std.sync)
}
```

### 5.4 Pinning and self-references (advanced; feature-gated)
Self-referential async state is a common hazard. Lumen v0.9 forbids creating references into a value that may move across await.
To enable advanced patterns (e.g., intrusive lists, generators), a `Pin[T]` abstraction is provided.

Normative rules if `Pin` is enabled:
- A value behind `Pin` is guaranteed not to move.
- Borrowing fields of a pinned value across `await` is permitted **only if**:
  1. the borrow is derived from a pinned receiver `&Pin[T]` or `&mut Pin[T]`, and
  2. the derived reference does not outlive the pinned container, and
  3. the compiler verifies the borrow points into pinned storage (not stack locals).

If `Pin` is not enabled, Rule A' applies universally.

### 5.5 Diagnostics
Violations at an await point must produce:
- error `E4101 Borrow across await`
- show the borrow origin, the await site, and the later use
- fix-it suggestions:
  - “move the value into the async block”
  - “limit the borrow scope”
  - “use `Ref/Arc` handle”
  - “clone data” (if cheap)

---

## 6. Exact Lifetime Rules for Returns (Normative)

### 6.1 Returning references
A function may return a reference only if the returned lifetime is tied to an input lifetime or `'static`.

Rule:
- For `fn f(x: &'a T) -> &'b U`, it is required that `'a : 'b` (i.e., `'b ⊆ 'a`).
- If multiple inputs, the output lifetime must be explicit and constrained by outlives relations.

### 6.2 Borrowing temporaries
References to temporaries are limited:
- Borrowing a temporary extends to the end of the **statement** by default.
- The compiler may extend to end of **let-binding** for convenience (temporary lifetime extension) only for `let r = &expr;` patterns.

Returning or storing a reference to a temporary beyond its extended lifetime is rejected (`E4202 Borrowed temporary`).

---

## 7. Mutation, Interior Mutability, and Runtime Sync (Normative)

### 7.1 Mutation through `&mut`
Mutation of a place `p` requires either:
- ownership of `p` (unique binding) OR
- an active `&mut p` loan.

### 7.2 Interior mutability (library feature)
Some reference types may support mutation through shared handles (e.g., `RefCell`, `Mutex`).
This does **not** weaken borrow rules; instead, it shifts checks to runtime.

Normative requirement:
- Types providing interior mutability must be marked by traits (`UnsafeCell`-like) and must be `unsafe` to implement.
- Methods that can deadlock or block must require `io` (or documented effect), because scheduling impacts determinism.

### 7.3 Thread safety marker traits
- `Send`: can be transferred to another task/thread safely.
- `Sync`: can be shared by reference across tasks/threads safely.

These traits are auto-derived when all fields are `Send/Sync`, except for interior-mutability primitives.

---

## 8. Regions (Arena Allocation) and Escapes (Normative)

### 8.1 Region blocks
`region { ... }` creates an arena whose allocations are freed when the block exits.

### 8.2 Region references
- References into region-allocated memory have a region lifetime `'r` that ends at region exit.
- It is illegal to return or store a `&'r T` outside the region.

Rule (escape prohibition):
If `e` produces a value containing a reference with region lifetime `'r`, then `e` must not escape the region scope.
Otherwise error `E4301 Region escape`.

### 8.3 Promotion/copy out
To return data, copy/clone/promote it into non-region storage:
- `tmp.clone()`
- `Vec::fromSlice(tmpSlice)` etc.

---

## 9. Unsafe and Raw Pointers (Normative)

### 9.1 Raw pointers are not checked
`Ptr[T]` may be copied freely. Dereferencing requires `unsafe`.

### 9.2 Unsafe obligations
Any `unsafe` block must uphold:
- pointer validity (non-null where required)
- alignment
- aliasing rules (must not create two `&mut` to same location)
- lifetime validity (must not create reference that outlives the allocation)

The compiler is not required to prove these, but must require explicit `unsafe` syntax and provide linting hooks.

---

## 10. Required Diagnostics (Normative)

Minimum error codes:
- `E4101` Borrow across await
- `E4102` Mutable borrow conflicts with active borrow
- `E4103` Use of moved value
- `E4201` Cannot return reference with inferred lifetime
- `E4202` Borrowed temporary does not live long enough
- `E4301` Region escape
- `E4401` Cannot borrow as mutable (not declared mut / not uniquely owned)

Each must include:
- spans for borrow origin and conflict point
- the relevant place(s) involved
- suggested fix-its where possible

---

## 11. Examples (Non-normative)

### 11.1 Classic aliasing rejection
```lumen
let mut x = 1
let a = &x
let b = &mut x     // E4102: cannot mutably borrow while shared borrow active
print(a)
```

### 11.2 NLL acceptance
```lumen
let mut x = 1
let a = &x
print(a)
let b = &mut x     // ok: a not used after this point
*b = 2
```

### 11.3 Await restriction fix
```lumen
fn f() async io {
  let mut v = Vec[Int]()
  v.push(1)

  // Don't hold &v across await
  let n = v.len()
  await sleep(1)
  print(n)
}
```

### 11.4 Region escape rejection
```lumen
fn bad() -> &Int {
  region {
    let x = 1
    &x        // E4301: region escape (and E4202 temp)
  }
}
```
