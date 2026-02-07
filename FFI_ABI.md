# FFI and ABI

## C ABI (Normative)
- Use `extern "C"` for FFI
- Only C-compatible layouts cross boundary
- FFI calls require `unsafe` unless wrapped by a validated safe interface

Example:
```lumen
extern "C" fn strlen(s: Ptr[U8]) -> Usize
```

## Representation attributes (Normative)
- `@repr(C)`
- `@repr(transparent)`
- `@repr(packed)` (unsafe to access unaligned)
- `@align(N)` (increase alignment to at least `N`)

## C-compatible type mapping (Normative)

The following mappings define what may appear in `extern "C"` function signatures.

- Integers map to the corresponding C integer types by width (`I32` ↔ `int32_t`, `Usize` ↔ `uintptr_t`, etc.).
- `Bool` is a 1-byte integer in memory and ABI; `0` is false and `1` is true.
- `Char` is a 32-bit Unicode scalar value (ABI-compatible with `uint32_t`).
- `Ptr[T]` maps to `T*` (`Ptr[Void]` maps to `void*`).
- `Slice[T]` maps to:
  ```c
  struct { T* ptr; uintptr_t len; }
  ```
  with field order and alignment as in `@repr(C)`.
- Function types `fn(A, B, ...) -> R` used in `@repr(C)` structs map to C function pointers with the platform C ABI.

## C varargs (`...`) (Normative)
Lumen permits declaring C varargs functions as `extern "C" fn name(fixed..., ...) -> R;`.

Calling convention:
- Varargs calls use the platform C ABI varargs convention.

Promoted types:
- Lumen does not perform implicit default-argument promotions. Arguments passed to `...` must be provided in their promoted C-ABI form as restricted by `SPEC.md` (§10.1.1).

## `@repr(C)` layout (Normative)

### Structs
- `@repr(C)` on a struct means its field order, size, and alignment match the platform C ABI rules for an equivalent C `struct`.

### Unions
`@repr(C)` on a `union` defines it as a C-compatible union layout:
- Every field has offset 0.
- The union size is the maximum size of any field, rounded up as required by alignment.
- The union alignment is the maximum alignment of any field (and any `@align(N)` requirement).

Accessing a union field is `unsafe` (reading or writing), because the active variant is a programmer-maintained invariant.

### Enums (tagged unions)
Plain C has no tagged union, but a common ABI pattern is:
```c
struct { int32_t tag; union { ... } payload; }
```

For Lumen:
- `@repr(C)` on an `enum` defines it as a tagged union layout:
  - A leading `tag: I32` field.
  - Followed by a payload storage region large enough to contain any variant payload, aligned to the maximum variant alignment.
- Variant tag values are `0..N-1` in source order.
- Variants with no payload occupy no payload bytes.

Without `@repr(C)`, enum layout is not specified and must not be relied upon for FFI.

### C bitfields
In `@repr(C)` structs, a field annotated `@bits(N)` is a C-compatible bitfield member.

Rules (normative):
- The field’s base type must be an integer type (`I8/I16/I32/I64/I128/Isize` or `U8/U16/U32/U64/U128/Usize`) or `Bool`.
- `N` must be an integer constant in the range `1..=bit_width(base_type)`.
- A bitfield member is not addressable: taking `&s.field` is invalid.
- Reading/writing a bitfield member is defined as extracting/inserting the corresponding bits within its containing storage unit.

Layout (normative):
- Bitfield layout and packing must match the platform C ABI for an equivalent C struct definition using bitfields of the corresponding C base type and width.
- Because C bitfield layout is target/ABI-specific, using `@bits` is primarily intended for FFI and is non-portable in the same way that C bitfields are non-portable.

## Linkage, symbol names, and visibility (Normative)

### Name mangling
Items declared `extern "C"` use the platform C ABI. Name mangling is controlled as follows:
- By default, toolchains may mangle non-`extern "C"` item names.
- `@no_mangle` on an item disables mangling for that item and uses the identifier as the link-time symbol name.
- `@link_name("symbol")` overrides the link-time symbol name used for import/export.

If both `@no_mangle` and `@link_name(...)` are present, `@link_name(...)` takes precedence for the link-time symbol name.

### Visibility
`@visibility("default"|"hidden")` controls whether a symbol is exported from a shared object or executable image.
Exact platform mappings (ELF/COFF/Mach-O) are toolchain-defined, but the meaning of the two states is normative:
- `"default"`: visible for dynamic linking
- `"hidden"`: not visible for dynamic linking

## Alignment (Normative)
`@align(N)` may be used to increase the alignment of a `@repr(C)` struct (and other items where supported by the language).
It must not reduce the ABI-required alignment.

## Notes on portability (Non-normative)
Even in C, bitfields and unions are common sources of portability pitfalls. Lumen supports them for interoperability, but code that depends on their exact layout should be treated as target-specific unless guarded by `@cfg(...)` and validated against the intended C toolchain.

## Hosted interop (Non-normative)
WASM/JS interop is out of scope for the v1.0 freestanding core.
