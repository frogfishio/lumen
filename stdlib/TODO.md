# Lumen-start roadmap: `json.lm`

Goal: ship a usable `packages/json/src/json.lm` JSON parser (and later serializer) while growing a real, testable slice of the Lumen stdlib (strings, utf-8, buffers, containers) and flushing out compiler/lowering bugs as we go.

Rules of engagement:
- [x] Keep increments small (one new helper / one new parse feature at a time)
- [x] After each change: `make run` and add/extend a smoke-check in `app/src/main.lm`
- [ ] Be explicit about ownership (who allocates, who frees)
- [ ] Prefer “C with hindsight” ergonomics: recognizable names, correct contracts

## Progress log (keep short)

- 2026-02-23: Baseline `make run` is green (expected `exit=2`).
- 2026-02-23: Added `lumen::utf8` module and refactored `json::scan_string` to use it:
  - `lumen::utf8::decode_u16_hex4_at` (used for JSON `\uXXXX` scanning)
  - `lumen::utf8::scan1` (validates one UTF-8 sequence; JSON string scan delegates to it)
- 2026-02-23: Tried adding `lumen::string::len/is_empty` wrappers; `sircc` failed in lowering. Reverted to restore green baseline.
  - Repro patch: `repro/sircc_string_len_is_empty.patch`
  - Details: `BUGS.md`

- 2026-02-25: Strings/stdlib demo path is green again (expected `exit=2`).
  - The earlier “debugger hang” was repeated intentional traps from a failing invariant in `str::trim_ascii_ws`/`str::eq`.
  - Root cause was a lowering gap: `string.utf8(ptr,len)` emitted as a member-callee call in the typed AST was not lowered correctly by `ast2sir`, producing bad `{data,len}` string views.

- 2026-02-25: Complex-generics stress is still blocked upstream (expected until full monomorphisation lands).
  - Case: `src/lang/lumen/tests/stress/stress__complex_generics.lm`
  - Failure is at `ast2sir` (“unsupported call to type 'main::Pair' as a value”).

- [ ] 2026-02-25: Pivot checklist (keep this as tasks until it’s fully locked in):
  - [x] `String` representation in practice is `string.utf8` (`{ data: ptr(i8), len: i64 }`).
  - [x] `String` is always-valid UTF-8.
  - [ ] Document where validation happens and what the `unsafe` escape hatches are (for constructing from raw bytes/pointers).
  - [ ] `lumen::str` is the primary string API.
  - [ ] `cstr` is interop only (NUL-terminated pointers).

## What to do next (while we wait for generics)

- Keep the “green path” tight:
  - After each stdlib change: run `make run` (expect `exit=2`) and extend `app/src/main.lm` with the smallest possible smoke-check.
- Drive JSON forward only through features that avoid generic-heavy surface areas:
  - Prefer cursor/lexer helpers (`skip_ws`, `peek`, `bump`, `expect_byte`) and string scanning improvements.
  - Keep `json::Value` MVP simple until containers/generics are unblocked (e.g. postpone `Object`/`Array` representation decisions if they force generic instantiation paths).

- Establish the stdlib “Error story” early, and thread it through JSON:
  - Prefer `Result[T, lumen::Error]` for fallible APIs instead of sentinel `-1`.
  - For parsers/lexers: use `Error::At(code, index, msg)` where `index` is a byte offset into the input slice.
  - Keep `msg` as a string literal (view) in v0; avoid dynamic formatting/allocations until `strbuf` lands.
- Track the generics blocker with a single-case stress invocation (so we notice when monomorphisation changes the typed-AST encoding):
  - `cd src/lang/lumen/tests && ./run_stress.py --suites stress --cases 'stress__complex_generics.lm' --only ast2sir --ast2sir-verify-producer`

## Milestone 0 — String contract + naming

- [x] Declare/commit: `String` is always-valid UTF-8 (`string.utf8`).
- [ ] Document `String` invariants:
  - [ ] `len` is bytes
  - [ ] may contain `0` bytes (NUL)
  - [ ] never invalid UTF-8 (construction validates or uses `unsafe` escape hatch)
- [ ] Document “view vs owned” rule:
  - [ ] `lumen::str` functions are non-allocating views unless explicitly a builder/allocator API.
  - [ ] owned allocations must have an explicit `free` path (no hidden ownership).
- [ ] Naming policy:
  - [ ] Use C-familiar names for UTF-8 string operations when semantics match (`strlen`, `strcmp`).
  - [ ] Reserve `cstr::*` for NUL-terminated C interop.

## Milestone A — Byte + string foundations

- [x] Decide/declare the first-class string representation: `String = string.utf8`.
- [ ] Decide/declare the first-class raw byte representation: `Bytes = Slice[U8]`.
- [ ] Document ownership conventions (separately):
  - [ ] `String` is a view type (ptr+len). It does not, by itself, imply ownership.
  - [ ] `Bytes = Slice[U8]` is raw input for parsers and may be non-UTF-8.
- [ ] Add `lumen::bytes` (or keep minimal helpers in `lumen::string` but treat it as bytes, not UTF-8 strings):
  - [ ] `len(bytes: Slice[U8]) -> Usize` (thin wrapper around `slice::len`)
  - [ ] `is_empty(bytes: Slice[U8]) -> bool`
  - [ ] `starts_with(bytes: Slice[U8], prefix: Slice[U8]) -> bool`
  - [ ] `index_of_byte(bytes: Slice[U8], b: U8) -> I64` (or `Option[Usize]`)
  - [ ] `trim_ascii_ws(bytes: Slice[U8]) -> Slice[U8]` (or cursor-based skipping)
  - [ ] `is_ascii_ws(b: U8) -> bool`
- [ ] Add `lumen::str` view helpers (UTF-8 `String`, non-allocating):
  - [ ] `strlen(s: String) -> I64` (byte length)
  - [ ] `strcmp(a: String, b: String) -> I32` (lexicographic compare on bytes)
  - [ ] `streq(a: String, b: String) -> bool`
  - [ ] `starts_with(s: String, prefix: String) -> bool`
  - [ ] `index_of_byte(s: String, b: U8, start: I64) -> I64`
  - [ ] `trim_ascii_ws(s: String) -> String` (view)
  - [ ] `substr_bytes_checked(s: String, start: I64, len: I64) -> String` (view, boundary-safe)
  - [ ] `unsafe substr_bytes_unchecked(s: String, start: I64, len: I64) -> String` (internal escape hatch)
- [ ] Add `lumen::utf8` primitives (minimal, parser-oriented):
  - [ ] `validate(bytes: Slice[U8]) -> bool` (optional at first)
  - [ ] `encode_codepoint_to_utf8(cp: U32, out: Buffer) -> Buffer`
  - [x] `decode_hex4(bytes: Slice[U8], i: Usize) -> Result[U16, Utf8Error]` (for `\uXXXX`)
    - Implemented as `decode_u16_hex4_at(bytes, i) -> I32` returning `-1` on failure.
  - [~] Handle surrogate pairs for JSON `\uD800..\uDFFF`
    - Currently validated in `json::scan_string` (pair structure + range checks).

## Milestone B — Buffer ergonomics for building strings

- [ ] Introduce `lumen::strbuf` (explicit owned UTF-8 builder):
  - [ ] `new() -> StrBuf`
  - [ ] `free(sb: StrBuf)`
  - [ ] `len_bytes(sb: StrBuf) -> Usize`
  - [ ] `push_byte(sb: StrBuf, b: U8) -> StrBuf` (for already-validated bytes)
  - [ ] `push_str(sb: StrBuf, s: String) -> StrBuf`
  - [ ] `push_codepoint(sb: StrBuf, cp: U32) -> StrBuf` (UTF-8 encode; guarantees validity)
  - [ ] `as_str(sb: StrBuf) -> String` (view into owned bytes; valid while sb lives)

- [ ] Decide how `String` becomes owned in value models:
  - [ ] Option A (preferred): `String` stays view-only; ownership lives in containers (e.g. `StrBuf`/`Buffer`).
  - [ ] Option B: add `OwnedString` with `free`.

- [ ] Add `lumen::buffer` helpers specialized for bytes:
  - [ ] `new_u8() -> Buffer`
  - [ ] `push_u8(b: Buffer, x: U8) -> Buffer`
  - [ ] `extend_from_slice_u8(b: Buffer, s: Slice[U8]) -> Buffer`
  - [ ] `to_slice_u8(b: Buffer) -> Slice[U8]` (alloc + copy, returns owned backing buffer + header)
  - [ ] `free_u8_slice(s: Slice[U8])` helper (free backing buffer + free header)

## Milestone C — JSON surface API + value model

- [ ] Define `json::Error` (span/index + code + message)
- [ ] Define `json::Value` representation (explicit ownership):
  - [ ] `Null`, `Bool`, `Number`, `String(String)`, `Array(...)`, `Object(...)`
  - [ ] Pick initial container strategy:
    - [ ] MVP: `Array` as `types::vector::Vector` of `Value`
    - [ ] MVP: `Object` as `types::vector::Vector` of `(String, Value)` pairs (linear lookup)
    - [ ] Later upgrade: `types::hashmap::HashMap` keyed by hashed `String`
- [ ] Decide JSON number storage:
  - [ ] MVP: store as `(is_float: bool, i: I64, f: F64)` or store raw bytes + parse-on-demand

- [ ] Define JSON string ownership story end-to-end:
  - [ ] Ensure JSON string parsing builds via `StrBuf` + `utf8` encoding so the resulting `String` is valid UTF-8.
  - [ ] Ensure `json::free` frees the owning buffers behind every stored `String`.

## Milestone D — Cursor + lexer helpers

- [ ] Implement `json::Cursor { bytes: Slice[U8], i: Usize }`
- [ ] Add cursor helpers:
  - [ ] `peek() -> Option[U8]`
  - [ ] `bump() -> Option[U8]`
  - [ ] `expect_byte(x: U8) -> Result[(), Error]`
  - [ ] `skip_ascii_ws()`
  - [ ] `at_end() -> bool`

## Milestone E — Parser (incremental features)

- [ ] Parse literals: `null`, `true`, `false`
- [ ] Parse numbers (JSON grammar): sign, integer part, fraction, exponent
- [ ] Parse strings (JSON escapes):
  - [ ] `\"`, `\\`, `\/`, `\b`, `\f`, `\n`, `\r`, `\t`
  - [ ] `\uXXXX` + surrogate pairs + UTF-8 encoding
- [ ] Parse arrays: `[ ... ]` with commas + whitespace
- [ ] Parse objects: `{ ... }` with string keys + `:` + commas + whitespace
- [ ] Ensure “no trailing junk” after a top-level value
- [ ] Add a recursion/stack limit for deeply nested JSON (to avoid runaway recursion)

## Milestone F — Tests + smoke checks (to drive compiler bugs out)

- [ ] Add tiny JSON fixtures in `app/src/main.lm` (start with hard-coded byte arrays)
- [ ] Add “happy path” cases:
  - [ ] `null`, `true`, `false`
  - [ ] numbers: `0`, `-1`, `1.5`, `1e9`, `-2.3E-4`
  - [ ] strings: ASCII, escapes, `\u0041`, surrogate pair emoji
  - [ ] arrays/objects with whitespace
- [ ] Add “error path” cases:
  - [ ] unterminated string
  - [ ] invalid escape
  - [ ] invalid number
  - [ ] unexpected EOF in array/object
  - [ ] trailing garbage
- [ ] Add a memory discipline test: parse → free all owned allocations (strings/arrays/objects)

## Milestone G — Serialization (optional after parser is solid)

- [ ] `json::stringify(value) -> String` using `strbuf` + escaping
- [ ] Round-trip tests: parse(stringify(v)) == v (for supported subset)

## Milestone X — Minimal C interop (`cstr`)

- [ ] Keep `cstr` scope intentionally small: interop convenience for `Ptr[U8]` + NUL.
- [ ] Provide only what ABI glue needs:
  - [ ] `c_strlen(p: Ptr[U8]) -> Usize`
  - [ ] `from_cstr(p: Ptr[U8]) -> ...` (decide whether this returns a view-only `String` or an owned allocation)
  - [ ] Avoid making `cstr` the main string story.
