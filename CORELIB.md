# Lumen Core Library Contract (v1.0-draft)

This document defines the minimum library surface a v1.0 Lumen toolchain targets. It is **normative** for the core profile.

The intent is to keep the *language* small while still giving the compiler a stable set of types for common patterns like fallible APIs.

## 1. Modules (Normative)

The core profile provides:
- `core.option`
- `core.atomic`
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

## 5. `core.atomic` (Normative)

The core profile provides atomics for targets that support concurrent execution. The memory model is specified in `SPEC.md`.

Memory order enum (names are stable):
```lumen
pub enum MemoryOrder {
  Relaxed,
  Acquire,
  Release,
  AcqRel,
  SeqCst,
}
```

Minimum required atomic surface (exact type set may grow; the names below are required if provided):
```lumen
@repr(transparent)
pub struct AtomicBool { /* implementation-defined */ }

@repr(transparent)
pub struct AtomicUsize { /* implementation-defined */ }

@repr(transparent)
pub struct AtomicIsize { /* implementation-defined */ }

@repr(transparent)
pub struct AtomicU32 { /* implementation-defined */ }

@repr(transparent)
pub struct AtomicI32 { /* implementation-defined */ }

pub fn AtomicUsize.load(self: Ptr[AtomicUsize], order: MemoryOrder) -> Usize
pub fn AtomicUsize.store(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> ()
pub fn AtomicUsize.swap(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize

pub fn AtomicUsize.compareExchange(
  self: Ptr[AtomicUsize],
  expected: Ptr[Usize],
  desired: Usize,
  success: MemoryOrder,
  failure: MemoryOrder,
) -> Bool

pub fn AtomicUsize.fetchAdd(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize
pub fn AtomicUsize.fetchSub(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize
pub fn AtomicUsize.fetchAnd(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize
pub fn AtomicUsize.fetchOr(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize
pub fn AtomicUsize.fetchXor(self: Ptr[AtomicUsize], v: Usize, order: MemoryOrder) -> Usize

pub fn AtomicBool.load(self: Ptr[AtomicBool], order: MemoryOrder) -> Bool
pub fn AtomicBool.store(self: Ptr[AtomicBool], v: Bool, order: MemoryOrder) -> ()
pub fn AtomicBool.swap(self: Ptr[AtomicBool], v: Bool, order: MemoryOrder) -> Bool

pub fn AtomicU32.load(self: Ptr[AtomicU32], order: MemoryOrder) -> U32
pub fn AtomicU32.store(self: Ptr[AtomicU32], v: U32, order: MemoryOrder) -> ()
pub fn AtomicU32.swap(self: Ptr[AtomicU32], v: U32, order: MemoryOrder) -> U32
pub fn AtomicU32.fetchAdd(self: Ptr[AtomicU32], v: U32, order: MemoryOrder) -> U32

pub fn AtomicI32.load(self: Ptr[AtomicI32], order: MemoryOrder) -> I32
pub fn AtomicI32.store(self: Ptr[AtomicI32], v: I32, order: MemoryOrder) -> ()
pub fn AtomicI32.swap(self: Ptr[AtomicI32], v: I32, order: MemoryOrder) -> I32
pub fn AtomicI32.fetchAdd(self: Ptr[AtomicI32], v: I32, order: MemoryOrder) -> I32

pub fn fence(order: MemoryOrder) -> ()
pub fn compilerFence(order: MemoryOrder) -> ()
```

Notes (normative):
- Atomics are library-provided abstractions over target atomics. Their operations are safe to call.
- Misalignment or invalid pointers passed to atomic operations are undefined behavior in `unsafe` code; safe wrappers should ensure invariants.
- `fence` is a hardware fence with the given memory order.
- `compilerFence` is a compiler reordering barrier consistent with the given memory order; it may compile to no instructions but must constrain optimization.

## 6. `core.slice` (Normative)

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

## 7. `core.intrinsics` (Normative)

Intrinsics are `unsafe` and may be implemented directly by the compiler backend.

```lumen
pub unsafe fn trap() -> Void;

pub unsafe fn volatileLoad[T](p: Ptr[T]) -> T;
pub unsafe fn volatileStore[T](p: Ptr[T], v: T) -> ();
```

`trap()` must terminate execution without unwinding.

Volatile intrinsics (normative):
- `volatileLoad`/`volatileStore` perform a volatile memory access suitable for MMIO.
- Volatile operations must not be elided, merged, or reordered with respect to other volatile operations.
- Volatile operations do not imply atomicity.
- Volatile operations do not imply ordering with respect to non-volatile memory operations; use `core.atomic.compilerFence`/`core.atomic.fence` or target-specific barriers when ordering is required.

Inline assembly (feature-gated) (normative):
- Toolchains may provide the inline assembly expression form `asm(...)` as specified in `SPEC.md` (§6.6).
