# Lumen Pitch

## What Lumen is
Lumen is a **21st‑century C**:
- freestanding-first (kernel/embedded-friendly)
- C ABI-native (`extern "C"`, `@repr(C)`)
- small surface area, strong typing
- safe-by-default, explicit `unsafe` when you need the hardcore
- designed to generate extremely tight code

## What Lumen is not (core profile)
- No mandatory runtime (no GC, no scheduler)
- No exceptions
- No hidden allocations

## Target Users
- C systems programmers
- kernel/embedded developers
- performance-critical infrastructure authors

## Adoption Strategy
- Be the most pleasant way to write and interop with C
- Great diagnostics + formatter + simple build story
- Start with a small, freestanding `core`; add optional hosted libraries later
