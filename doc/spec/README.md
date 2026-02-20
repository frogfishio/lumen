# Lumen — A 21st‑Century C

Lumen is a **freestanding-first**, **C ABI-native** language aimed at being a *real* C replacement:
small, strongly typed, safe-by-default, and capable of producing extremely tight codegen.

Non-goals for the core language:
- Mandatory runtime (GC, scheduler, exceptions)
- Hidden allocations

Docs:
- `SPEC.md` — Core language specification (normative)
- `LUMEN_EBNF.md` — Surface grammar (normative)
- `FFI_ABI.md` — C ABI and representation rules (normative)
- `CORELIB.md` — Core library contract (normative)
- `COMPILER_MVP.md` — Implementation checklist (non-normative)
- `TOOLING.md` — CLI and tooling expectations
- `COMPATIBILITY.md` — Editions, deprecations, versioning policy
 - `examples/` — Small example programs
 - `conformance-suite/` — Language + ABI conformance fixtures (single folder)
 - `examples/cimport/` — Example `lumen.toml` for reproducible C header import

Legacy / future ideas (non-normative, may be reintroduced as an optional hosted profile):
- `EFFECTS_SYSTEM.md`, `MEMORY_BORROW_ASYNC.md`, `STDLIB_API_SURFACE.md`
