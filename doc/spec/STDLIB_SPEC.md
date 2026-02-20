# Standard Library Specification

> **Note:** This is a v0.9-era sketch of a hosted standard library. The v1.0 core language spec in `SPEC.md` is freestanding-first and intentionally does not require a standard library.

## Stability tiers (Normative)
- `core`: stable, no breaking changes within an Edition
- `std`: stable, may add APIs
- `experimental`: feature-gated, unstable

## Core modules
- `core.option`: Option
- `core.result`: Result
- `core.iter`: Iterator
- `core.cmp`: Eq/Ord
- `core.hash`: Hash
- `core.fmt`: formatting

## Std modules
- `std.vec`: Vec[T]
- `std.map`: Map[K,V]
- `std.set`: Set[T]
- `std.string`: String/Str
- `std.atomic`: atomic types and helpers (hosted DX layer over `core.atomic`)
- `std.simd`: SIMD vector types and operations (portable API with target specializations)
- `std.io`: File/Path/Stream
- `std.net.http`: HTTP client/server
- `std.json`: JSON parsing/encoding
- `std.time`: Duration/Instant/DateTime
- `std.task`: Task/Executor/Cancellation
- `std.sync`: Mutex/RwLock
- `std.test`: test harness/snapshots
- `std.log`: structured logging

## Error conventions (Normative)
- Fallible APIs return Result
- Error types implement `std.error.Error` (message, optional code, cause, backtrace)
