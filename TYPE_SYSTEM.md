# Lumen Type System, Inference Rules, and Trait Resolution (v0.9-draft)

> **Scope:** This chapter is intended to be added to `SPEC.md` as a normative section.  
> **Status:** Draft-but-detailed. Where an implementation must choose between options, the spec makes the choice explicit.  
> **Notation:** Judgments use `Γ ⊢ e : τ ▷ ε` meaning “under environment Γ, expression e has type τ and requires effect-set ε”.

---

## 1. Core Type Language (Normative)

### 1.1 Types
Types `τ` include:

- Primitive: `Bool`, `I32`, `I64`, `F64`, `Char`, `()` etc.
- Type constructors: `Vec[τ]`, `Map[κ, υ]`, `Option[τ]`, `Result[τ, ϕ]`, user-defined `struct`/`enum`.
- Tuples: `(τ1, …, τn)`
- Arrays: `[τ; N]`
- References: `&τ`, `&mut τ`
- Pointers: `Ptr[τ]`, managed refs `Ref[τ]`
- Function types: `fn(τ1,…,τn) -> τr` with effects `ε` and (optional) generic parameters
- Trait objects: `dyn T` (must appear behind `Ref` or `&` in safe code, per object-safety rules)

### 1.2 Type variables and schemes
- Type variables: `α, β, …`
- **Scheme**: `σ ::= ∀ ᾱ . τ where C̄`
  - `C̄` is a set of constraints (trait bounds / equalities / effect constraints).
- Let-bound polymorphism is supported for **non-expansive** expressions (see §3.5).

### 1.3 Effects as a type component
- Effects are a **set** `ε ⊆ {async, throws, io}`
- Function type includes an effect-set: `fn(τ̄) ε -> τ`
- Subtyping relation for effects: `ε1 ≤ ε2` iff `ε1 ⊆ ε2`.

### 1.4 Environments
- `Γ` maps term identifiers to schemes: `x : σ`
- `Δ` maps type identifiers to type constructors (struct/enum definitions)
- `Π` is the **trait environment** (trait declarations + impl database)
- Judgments assume access to `(Δ, Π)` globally.

---

## 2. Constraint Forms (Normative)

Constraints `C` include:
- **Equality:** `τ1 = τ2`
- **Trait bound:** `τ : Trait[τ̄]` (including associated types; see §7)
- **Effect bound:** `ε ≤ ε'` (generated primarily by higher-order calls)

A constraint set is satisfiable if there exists a substitution for type variables and an effect-set assignment that makes all constraints true under the trait database Π.

---

## 3. Inference Overview (Normative)

Lumen uses a **hybrid** algorithm:
- Hindley–Milner-style unification for local inference
- Constraint solving for traits and effects
- Bidirectional checking for annotations and to improve diagnostics
- Monomorphization at codegen time (like Rust/Swift) for generic functions (trait objects are explicitly dynamic).

### 3.1 Judgments
We use:
- `Γ ⊢ e ⇒ τ ▷ ε ⊣ C`  (**synthesis**) : infer type τ, effects ε, constraints C
- `Γ ⊢ e ⇐ τ ▷ ε ⊣ C`  (**checking**) : check e against expected type τ

### 3.2 Substitutions
A substitution `S` maps type variables to types.
Applying substitution to types and constraints is written `S(τ)` and `S(C)`.

### 3.3 Generalization and instantiation
- `generalize(Γ, τ, C)` quantifies type variables free in `(τ,C)` but not free in `Γ`, subject to the value restriction.
- `instantiate(σ)` replaces universally quantified vars with fresh vars.

### 3.4 Value restriction (non-expansive)
To avoid unsoundness with effects and mutable state, Lumen generalizes only **non-expansive** let RHS:
Non-expansive includes literals, lambdas/closures, tuples/struct literals of non-expansive parts, and references to values.
Expansive includes function calls, `await`, `io` ops, allocations in region/heap (implementation-defined), and anything with effects `ε ≠ ∅`.

Rule: `let x = e;` generalizes `x` only if inferred `ε = ∅` and `e` is non-expansive.

### 3.5 Principal types
If constraint solving succeeds, inferred types are principal up to trait/effect ambiguity. When multiple impls match, ambiguity is an error unless resolved by annotations or specialization rules (§8).

---

## 4. Core Typing Rules (Normative)

Below, `fresh()` yields a fresh type variable. `⊎` denotes effect-set union.

### 4.1 Variables
**(VAR)**
If `x : σ ∈ Γ` and `instantiate(σ) = (τ, C)` then:
```
Γ ⊢ x ⇒ τ ▷ ∅ ⊣ C
```

### 4.2 Literals
**(LIT)**
```
Γ ⊢ 42 ⇒ Int ▷ ∅ ⊣ ∅
Γ ⊢ "hi" ⇒ String ▷ ∅ ⊣ ∅
Γ ⊢ true ⇒ Bool ▷ ∅ ⊣ ∅
```

### 4.3 Lambda / closure
A closure without annotation introduces fresh param types.
**(LAM⇒)**
For `fn(p1,…,pn) [εf] -> τr { body }`:
- introduce fresh `α1…αn` for params (unless annotated)
- extend environment with patterns bound to those types (pattern typing §4.9)
- infer body: `Γ' ⊢ body ⇐ τr ▷ εb ⊣ Cb`
- total effects include closure-declared effects (must cover body): `εb ⊆ εf` (constraint)
Result:
```
Γ ⊢ fn(...) {body} ⇒ fn(ᾱ) εf -> τr ▷ ∅ ⊣ (Cb ∪ {εb ≤ εf})
```
Closures are values; constructing them is effect-free.

### 4.4 Application (function call)
**(APP)**
If:
- `Γ ⊢ f ⇒ τf ▷ εf ⊣ Cf`
- `Γ ⊢ ai ⇒ τi ▷ εi ⊣ Ci` for each arg
Let `τf` be unified with `fn(β̄) εcall -> βr` (fresh `β`):
Add constraints: `τi = βi` for all args.
Result effects: `εf ⊎ (⊎ εi) ⊎ εcall`
```
Γ ⊢ f(a1..an) ⇒ βr ▷ (εf ∪ εargs ∪ εcall) ⊣ (Cf ∪ Cargs ∪ {τi=βi})
```

### 4.5 If expression
**(IF)**
- condition must be Bool
- branches unify
Effects union across condition + both branches:
```
Γ ⊢ if c {t} else {e} ⇒ τ ▷ (εc ∪ εt ∪ εe) ⊣ (Cc ∪ Ct ∪ Ce ∪ {τt=τe} ∪ {τc=Bool})
```

### 4.6 Match
Each arm must produce same type (unify). Pattern introduces bindings and constraints.
Exhaustiveness is a separate check (not type inference).

### 4.7 Let-binding
**(LET)** (non-expansive)
Infer `e ⇒ τ ▷ ∅ ⊣ C` and `e` non-expansive. Solve minimal constraints for generalization shape if needed.
Then `σ = generalize(Γ, τ, C)` and type-check body with `Γ, x:σ`.

**(LET-MONO)** (expansive or effectful)
If `ε ≠ ∅` or `e` expansive, bind monomorphically:
`x : τ` with any remaining constraints carried into surrounding scope.

### 4.8 Return / break / continue
Return checks against function expected return type. `break` may carry a value only in `loop` with a loop result type variable (like Rust), else must be unit.

### 4.9 Pattern typing (selected rules)
Patterns are checked against an expected type `τ` and produce bindings.

- Wildcard `_` binds nothing.
- Identifier `x` binds `x:τ`.
- Tuple pattern `(p1,…,pn)` requires `τ = (τ1,…,τn)` and checks each.
- Enum pattern `Some(p)` requires scrutinee type unify with `Option[τv]` etc.
- Struct patterns require field presence/types.

Formally: `Γ ⊢pat p ⇐ τ ⊣ (Γp, Cp)` where `Γp` are new bindings.

---

## 5. Unification (Normative)

Type equality constraints are solved by **first-order unification** with occurs-check.
- Unify type constructors structurally.
- Unify references invariantly (`&T` unifies with `&T` only; no variance in this draft).
- Function types unify parameter-wise and return-wise; effect-sets generate effect constraints (not unified as types).
- `Any` unifies with any type only via explicit cast `as Any` or `as T` (no implicit Any).

Failures produce diagnostic codes:
- `E1001` cannot unify types
- `E1002` occurs check
- `E1003` mismatched arity

---

## 6. Type Checking Algorithm (Normative)

Implementation MUST perform these stages (may be interleaved for performance):
1. **Parse** to AST.
2. **Name resolution** to bind identifiers to symbols (produces Γ skeleton).
3. **Inference** producing `(τ, ε, C)` for each expression.
4. **Unification** to solve equality constraints and produce substitution `S`.
5. **Trait/effect solving** to discharge trait constraints and effect subset constraints.
6. **Monomorphization plan**: choose type arguments for generics and record instantiated forms.
7. **Final type assignment**: apply substitution and chosen impls to produce fully typed IR.

If any stage fails, the compiler must not proceed to later stages for the failing module.

---

## 7. Trait System (Normative)

### 7.1 Trait declarations
A trait introduces:
- method signatures
- optional associated types (feature-gated in this draft but supported by algorithm)
- supertraits (bounds)

Example:
```lumen
trait Iterator[T] {
  fn next(&mut self) -> Option[T];
}
```

### 7.2 Trait bounds
Constraint form: `τ : Trait[τ̄]`
- `τ` is the “self type”
- `τ̄` are trait parameters (if any)

### 7.3 Coherence (orphan rule)
An `impl Trait for Type` is legal only if:
- the trait is defined in the current package OR
- the type is defined in the current package
(Extension packages may relax this behind a feature gate; not in this draft.)

### 7.4 Overlap and specialization
Two impls **overlap** if there exists a substitution making both apply to the same type(s) with satisfiable where-clauses.
- Overlap is **rejected** at compile-time unless one is marked `@specialize` and is strictly more specific (feature gate).
- Default: **no specialization**; hence overlap is an error.

---

## 8. Trait Resolution Algorithm (Normative)

Trait resolution answers: given constraint `τ : Trait[τ̄]`, find a unique impl in Π and produce any required sub-obligations.

### 8.1 Data in Π
Π contains:
- Trait declarations with their method sets and supertraits.
- Impl entries:
  - header: `impl[ᾱ] Trait[args] for SelfType where W`
  - where-clause `W` as constraints (trait bounds + equalities)

### 8.2 Canonicalization
Before solving, the compiler canonicalizes the goal:
- Replace inference vars with canonical placeholders to enable caching.
- Normalize obvious type aliases.
- Apply current substitution `S` from unification.

### 8.3 Resolution procedure (deterministic)
Given goal `G = (τ : Tr[τ̄])`:

**Step 0: Normalize**
- Apply substitution `S` from equality unification: `G := S(G)`.
- If `τ` contains unresolved type vars, resolution may proceed in “deferred” mode (see 8.6).

**Step 1: Candidate collection**
Collect all impls `I` in Π whose headers *may* match:
- Unify `SelfType_I` with `τ` producing substitution `Si` (unification here is on *types*, ignoring where-clauses initially).
- Unify `args_I` with `τ̄` producing additional `Si`.
If unification fails, impl is not a candidate.

**Step 2: Obligation generation**
For each candidate `I` with substitution `Si`, generate obligations:
- where-clause constraints `W_I` instantiated by `Si`
- supertrait obligations: if `Tr: Super1 + Super2`, add `τ : Super1`, `τ : Super2` (instantiated)
Let `Oi` be the set of obligations for candidate `I`.

**Step 3: Feasibility check**
A candidate is **feasible** if all obligations `Oi` are satisfiable by recursive resolution.
- Use a recursion depth limit and cycle detection.
- Cycles are allowed only if they are “productive” (e.g., through a type constructor) — otherwise error `E2104 Trait cycle`.

**Step 4: Selection**
- If **no** feasible candidates: error `E2001 Missing impl` with best “why” trace.
- If **exactly one** feasible candidate: select it, record selected impl + substitution, and succeed.
- If **more than one** feasible candidate: attempt disambiguation:
  1. Prefer candidates that are strictly **more specific** by the *impl specificity ordering* (8.5).
  2. If still multiple, require user annotation (type ascription or explicit generic arguments) and emit `E2002 Ambiguous impl`.

### 8.4 Recursion and caching
Resolution uses a worklist of goals with memoization:
- Cache: canonical goal → result (success with chosen impl, or failure, or ambiguity)
- On re-encountering a goal in the current stack, treat as a cycle and apply cycle rules.

### 8.5 Specificity ordering (no specialization)
To keep determinism without specialization, Lumen defines a conservative ordering:
Impl A is **more specific** than Impl B if, after renaming generics apart:
- A’s header unifies with B’s header, but not vice versa, **and**
- A’s where-clause is at least as strong (i.e., implies B’s where-clause under the same substitution).

In practice, because implication is hard, the compiler uses:
- Structural match check: A’s self type is structurally more concrete (fewer type vars / more constructors).
- Where-clause subset check: B’s bounds are a subset of A’s bounds under the unifier.
If ordering cannot be established, treat as ambiguous.

### 8.6 Deferred goals (inference interaction)
If `τ` contains unresolved inference variables, the solver may:
- **Defer** the goal until more type info is known, if doing so could remove ambiguity.
- But if compilation reaches a “commit point” (end of function body) with deferred goals unresolved, it is an error `E2003 Cannot infer trait`.

Commit points:
- end of function
- explicit type annotation boundary
- public item signature finalization

### 8.7 Associated types (feature-gated but supported)
If trait has associated type `Item`, constraints may include projection:
- `Assoc(τ : Iterator).Item = τItem`

Resolution normalizes associated types by:
- selecting an impl for `τ : Iterator`
- reading associated type definition from that impl
- producing equality constraint to `τItem`
Cycles in associated types are rejected unless structurally decreasing.

---

## 9. Effect Constraints and Checking (Normative)

Effects are checked via subset constraints.

### 9.1 Effect inference for calls
From (APP), total effects include callee effects `εcall` plus subexpression effects.
If a function is declared with effects `εdecl`, then within its body, every expression must satisfy:
- inferred effects `εexpr ⊆ εdecl`
Violations: `E3001 Effect not permitted` with a suggestion to add the missing effect keyword(s).

### 9.2 Higher-order effects
When passing a function/closure value:
- Its type includes its effect-set.
- Calling it adds that effect-set to the caller expression’s effect-set.

---

## 10. Diagnostics Requirements (Normative)

Type/trait errors must include:
- the inferred type(s) with spans
- the expected type(s)
- the unification/trail that produced the mismatch when helpful
- for missing impl: show the goal, candidate impls rejected, and the first failed obligation chain

Minimum error codes:
- `E1001` type mismatch (cannot unify)
- `E2001` missing trait implementation
- `E2002` ambiguous trait implementation
- `E2003` cannot infer trait
- `E2104` trait cycle
- `E3001` effect not permitted

---

## 11. Worked Example (Non-normative)

```lumen
fn lenPlusOne[T](xs: Vec[T]) -> Int {
  xs.len() + 1
}
```
1. `xs : Vec[α]`
2. `xs.len()` requires trait `Vec[T] : HasLen` (or inherent method); if trait-based:
   goal `Vec[α] : HasLen`
3. solver finds impl `impl[T] HasLen for Vec[T]`
4. returns `Int` and unifies `+` operands, etc.
