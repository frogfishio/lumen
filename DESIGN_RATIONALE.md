# Lumen Design Rationale (Non‑normative)

## Effects
Hidden async/IO/exceptions cause refactor hazards. Effects make “what this code can do” explicit,
while still enabling inference and ergonomic higher-order functions.

## Null avoidance
Null creates ambiguous contracts. Option types make absence explicit and compiler-assisted.

## Structured concurrency
Scope-bound tasks drastically reduce leaks, races, and shutdown complexity and make cancellation predictable.

## Memory: automatic by default, control when needed
Most developers want safety and speed of iteration. Advanced users want performance.
Lumen provides a safe default and opt-in regions/unsafe for critical paths.

## One formatter
Tooling quality and collaboration improve when formatting is deterministic and universal.
