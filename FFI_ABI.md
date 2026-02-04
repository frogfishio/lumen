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

## `@repr(C)` layout (Normative)

### Structs
- `@repr(C)` on a struct means its field order, size, and alignment match the platform C ABI rules for an equivalent C `struct`.

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

## Hosted interop (Non-normative)
WASM/JS interop is out of scope for the v1.0 freestanding core.
