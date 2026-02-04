# Lumen Effects System: Checking, Subtyping, and Polymorphism (v0.9-draft)

> **Note:** This document describes Lumen’s earlier v0.9 direction (effects/async/IO). It is **not** part of the v1.0 “new C” core language spec in `SPEC.md`. Kept as design notes for a possible future hosted profile.

> **Status:** Draft-but-precise. Intended as a normative chapter for `SPEC.md`.  
> **Purpose:** Make async, error propagation, and IO *explicit and checkable* without destroying ergonomics.  
> **Effects in v0.9:** `async`, `throws`, `io`.

---

## 1. Effect Sets and the Effect Lattice (Normative)

### 1.1 Effect set
An **effect set** is a finite set:
```
ε ⊆ E   where E = { async, throws, io }
```

We write `∅` for the empty effect set.

### 1.2 Ordering (subtyping on effects)
Effect sets form a powerset lattice ordered by subset:

- **Subeffecting (effect subtyping):**
```
ε₁ ≤ ε₂   iff   ε₁ ⊆ ε₂
```

- **Join (least upper bound):**
```
ε₁ ⊔ ε₂ = ε₁ ∪ ε₂
```

- **Meet (greatest lower bound):**
```
ε₁ ⊓ ε₂ = ε₁ ∩ ε₂
```

### 1.3 Intuition
- Code that requires fewer capabilities can run where more are allowed.
- Code that may do IO cannot be used in a context that forbids IO.

---

## 2. Effectful Function Types (Normative)

### 2.1 Function type form
A function type includes an effect set:
```
fn(τ1, …, τn) ε -> τr
```

### 2.2 Subeffecting for function types
Given two function types with the same parameter and return types (after usual type unification),
a function requiring **fewer** effects can be used where more effects are expected:

```
fn(τ̄) ε1 -> τ   <:   fn(τ̄) ε2 -> τ     if   ε1 ≤ ε2
```

This is *subeffecting* and is independent from other variance rules.
(Overall function variance remains: parameters contravariant, return covariant; effects are covariant with respect to `≤`.)

### 2.3 Declared effects are an upper bound
If a function is declared with effects `εdecl`, then **every expression** in its body must have inferred effects `εbody`
such that:
```
εbody ≤ εdecl
```
Violations are compile-time errors.

---

## 3. Typing Judgment with Effects (Normative)

### 3.1 Judgment form
We use:
```
Γ ⊢ e : τ ▷ ε
```
meaning: “under environment Γ, expression `e` has type `τ` and requires effect set `ε`.”

(Implementations may use a constraint-based internal representation; the semantics here are equivalent.)

### 3.2 Effect accumulation principle
For any composite expression, its effect set is the **join** of its subexpressions' effect sets plus any intrinsic effect:
```
ε(e) = ⊔ᵢ ε(subᵢ)  ⊔  ε_intrinsic(e)
```

---

## 4. Effect Introduction Rules (Normative)

This section defines which constructs introduce which intrinsic effects.

### 4.1 Async introduction
- `await e` requires `async`.
- Any call whose callee type includes `async` requires `async`.

Formally:
```
Γ ⊢ e : Async[T] ▷ ε
———————————————  (AWAIT)
Γ ⊢ await e : T ▷ (ε ⊔ {async})
```
`Async[T]` is an internal meta-type representing an awaitable; the surface type system may model this via `Future[T]` in std.

### 4.2 Throws introduction
- `try e` propagates errors; it requires `throws` in the current function.
- Any call whose callee type includes `throws` requires `throws`.

Rule:
```
Γ ⊢ e : Result[T, E] ▷ ε
——————————————————————————  (TRY)
Γ ⊢ try e : T ▷ (ε ⊔ {throws})
```
Notes:
- `try` is only well-typed when the *enclosing function’s declared effects* include `throws` (checked by §7).

### 4.3 IO introduction
Any operation designated “IO” by the standard library (filesystem, network, env, time, randomness, process, etc.)
introduces `io`.

This is modeled by IO-marked functions in `std` having `io` in their function type effects, e.g.:
```
fn readFile(path: String) io throws -> Bytes
```
Therefore `io` is introduced via call (APP) rule.

### 4.4 Panic is not an effect
`panic` is treated as an unrecoverable trap and is not represented by `throws` (which is for recoverable errors).
Panic behavior is governed by the runtime configuration (unwind/abort) and separate safety guidelines.

---

## 5. Effect Checking of Calls (Normative)

Let the call typing rule be (simplified):

If:
- `Γ ⊢ f : fn(τ̄) εf -> τr ▷ ε0`
- `Γ ⊢ ai : τi ▷ εi` for each argument
then:
```
Γ ⊢ f(ā) : τr ▷ (ε0 ⊔ (⊔ εi) ⊔ εf)
```

This is the only way effects “flow” into expressions besides intrinsic constructs (`await`, `try`).

---

## 6. Effect Polymorphism (Normative)

### 6.1 Motivation
Higher-order functions must reflect the effects of callbacks. Example: `map` calling a `throws` function should itself be `throws`.

### 6.2 Effect variables
Introduce **effect variables** `ρ` ranging over effect sets.

An effect-polymorphic function scheme may quantify over effect variables:
```
∀ ᾱ, ρ̄ . fn(τ̄) ρ -> τr   where C
```
where constraints may mention subset relations between effect variables and concrete sets.

### 6.3 General rule: effect of calling a parameter
If a function parameter `k` has type `fn(A) ρ -> B`, then inside the body,
calling `k(x)` introduces effect `ρ`.

### 6.4 Encoding “callback effects propagate”
For a higher-order function `hof` that calls `f`, the effect of `hof` must include the effect of `f`.

Example signature:
```
fn map[T, U, ρ](xs: Vec[T], f: fn(T) ρ -> U) ρ -> Vec[U]
```
This states: `map` itself has effect `ρ` exactly (modulo other effects it might introduce).

### 6.5 Effect inference for higher-order functions
When a function definition has **no explicit effects annotation**, the compiler may infer `εdecl` from the body and write it
into the typed IR, but **public APIs must specify effects** unless the compiler can prove the signature is stable and unambiguous.
Policy:
- `pub fn ...` must declare effects explicitly, or `E3005 Public effect elided` is emitted with a fix-it.

### 6.6 Effect constraints solving
During inference, the compiler generates constraints:
- `εexpr ≤ εdecl` for every function body
- `ρ ≤ εdecl` when a quantified effect var must be permitted by a context
- `εcall ≤ εcontext` when passing a function value to a consumer expecting fewer effects (subeffecting)

A constraint solver must compute the **least** effect assignment satisfying all subset constraints (least fixed point),
or report unsatisfiable constraints.

---

## 7. Effect Contexts and Enforcement (Normative)

### 7.1 Function bodies
Let the current function have declared effect set `εF`.
Every expression `e` in its body must satisfy:
```
Γ ⊢ e : τ ▷ εe     and     εe ≤ εF
```
If not, emit `E3001 Effect not permitted` and suggest adding missing effect keywords to the function signature:
- if `{async} ⊄ εF`, suggest adding `async`
- if `{throws} ⊄ εF`, suggest adding `throws`
- if `{io} ⊄ εF`, suggest adding `io`

### 7.2 Nested functions and closures
A closure has its own declared effect set `εC` (explicit or inferred).
Within closure body, check `εbody ≤ εC` exactly as for functions.

Constructing a closure is effect-free; calling it introduces its declared effects.

### 7.3 `try` placement rule
`try e` is permitted only if current effect context includes `throws`.
If not, emit `E3002 try requires throws`.

### 7.4 `await` placement rule
`await e` is permitted only if current effect context includes `async`.
If not, emit `E3003 await requires async`.

### 7.5 “Pure zones”
Within contexts expecting `∅` (e.g., compile-time constant expressions if/when CTFE exists), any non-empty effect is an error.

---

## 8. Subeffecting in Parameter Passing (Normative)

### 8.1 Passing a function where fewer effects are expected
If a context expects a callback of type `fn(A) εexpected -> B`, and you provide a function value of type
`fn(A) εgiven -> B`, this is allowed only if:
```
εgiven ≤ εexpected
```
Otherwise error `E3006 Callback too effectful`.

### 8.2 Example
- Expected: `fn(Int) ∅ -> Int` (pure callback)
- Given: `fn(Int) {io} -> Int` (does IO)

Rejected, because `{io} ⊄ ∅`.

---

## 9. Effect Subtyping with Generics (Normative)

### 9.1 Quantified effect variables are invariant by default
An effect variable `ρ` is a parameter to a polymorphic function. Substitution must respect subset constraints,
but there is no “implicit widening” during instantiation beyond the constraint solver.

### 9.2 Instantiation rule
When instantiating `∀ ρ . ...`, replace `ρ` with a fresh effect variable `ρ'` constrained by the call site requirements.
If the surrounding context requires `εctx`, then add constraint:
```
ρ' ≤ εctx
```
This ensures a pure context cannot accidentally accept an effectful instantiation.

### 9.3 Principal effects
The compiler must compute the least `ε` for each expression. For effect-polymorphic functions, this means producing the
most general `ρ` with minimal constraints.

---

## 10. Interaction with Type Inference (Normative)

### 10.1 Effects are inferred alongside types
The type inference algorithm produces `(τ, ε)` for expressions. Type resolution may affect effects via method dispatch:
- Selecting an impl might choose a method body with different effects.
Therefore, effect inference must occur **after** method/impl selection, or in a mutually recursive pass.

Normative requirement:
- The final inferred effects for a call must match the selected callee’s effect set.

### 10.2 Deferred goals
If method selection is deferred due to type variables, effect computation is deferred similarly.
At commit points (end of function), any unresolved effect variable must be resolved or compilation errors:
- `E3007 Cannot infer effects`

---

## 11. Standard Library Marking Rules (Normative)

The standard library must classify APIs as follows:

- Pure: effect set `∅`.
- Async-only: `{async}`.
- Throws-only: `{throws}`.
- IO-only: `{io}`.
- Combinations permitted: e.g., `{async, io, throws}` for network calls that fail and await.

Rule:
- Any API that reads clock/time, random numbers, environment variables, filesystem, network, process, or concurrency scheduling MUST include `io` unless explicitly documented as deterministic and sandboxed.

---

## 12. Diagnostics (Normative)

Minimum required effect diagnostics:
- `E3001` Effect not permitted in this context
- `E3002` `try` requires `throws`
- `E3003` `await` requires `async`
- `E3005` Public function must declare effects
- `E3006` Callback too effectful for expected type
- `E3007` Cannot infer effects (add annotation)

Diagnostics must include:
- inferred effect set
- required/allowed effect set
- a minimal fix-it (e.g., add `throws` to signature)

---

## 13. Worked Examples (Non-normative)

### 13.1 Propagating callback throws
```lumen
fn map[T,U,ρ](xs: Vec[T], f: fn(T) ρ -> U) ρ -> Vec[U] {
  // calling f introduces ρ, so map is ρ
}
```
If `f` is instantiated as `throws`, then map becomes `throws` at that call site.

### 13.2 Pure callback required
```lumen
fn withLock[T](m: &Mutex[T], f: fn(&mut T) ∅ -> ()) io -> () { ... }
```
Trying to pass a callback that does IO is rejected because it could deadlock / reenter unpredictably.

### 13.3 `await` needs `async`
```lumen
fn main() {
  await http.get("/")  // E3003
}
fn main() async io throws { ... } // ok
```
