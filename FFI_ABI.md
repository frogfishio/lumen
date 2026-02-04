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

## WASM + JS (Normative surface)
- Strings cross boundary as UTF‑8 bytes + length
- Promises map to async/await
