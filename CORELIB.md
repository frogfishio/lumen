# Lumen Core Library Contract (v1.0-draft)

This document defines the minimum library surface a v1.0 Lumen toolchain targets. It is **normative** for the core profile.

The intent is to keep the *language* small while still giving the compiler a stable set of types for common patterns like fallible APIs.

## 1. Modules (Normative)

The core profile provides:
- `core.option`
- `core.ptr`
- `core.result`
- `core.slice`
- `core.intrinsics` (compiler-provided, `unsafe`)

## 2. `core.option` (Normative)

```lumen
pub enum Option[T] {
  Some(T),
  None,
}
```

## 3. `core.result` (Normative)

```lumen
pub enum Result[T, E] {
  Ok(T),
  Err(E),
}
```

## 4. `core.ptr` (Normative)

```lumen
pub fn ptr.null[T]() -> Ptr[T]
pub fn ptr.isNull[T](p: Ptr[T]) -> Bool
```

## 5. `core.slice` (Normative)

`Slice[T]` is a core language type with a C-compatible layout.

```lumen
@repr(C)
pub struct Slice[T] {
  ptr: Ptr[T],
  len: Usize,
}
```

Required operations (may be compiler intrinsics or library code):
- `Slice.len(self: Slice[T]) -> Usize`

Indexing semantics are specified in `SPEC.md` (§9).

## 6. `core.intrinsics` (Normative)

Intrinsics are `unsafe` and may be implemented directly by the compiler backend.

```lumen
pub unsafe fn trap() -> Void;
```

`trap()` must terminate execution without unwinding.
