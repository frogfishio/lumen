# Compiler Error Philosophy

Every error must:
1. Explain what happened
2. Explain why
3. Show minimal fix
4. Link to docs

Errors are actionable, not cryptic.

## Selected v1.0 core error codes

The v1.0 core spec requires stable diagnostic codes (see `SPEC.md`). Toolchains should, at minimum, implement:
- `E0501` Ambiguous integer literal (add type annotation or `as` cast)
- `E0502` Refutable pattern not allowed in `let`/`for` (use `match`)
- `E0503` `for` requires `Slice[T]` or `[T; N]`
- `E0504` Non-exhaustive `match` on enum
- `E0505` Dot-call resolves only inherent methods (use UFCS for trait methods)
- `E0506` Invalid C varargs argument type (cast to a promoted C ABI type)
- `E0507` Invalid static initializer (must be compile-time)
- `E0508` Access to `static mut` requires `unsafe`
- `E0509` Invalid inline asm form (unsupported options/operands)
