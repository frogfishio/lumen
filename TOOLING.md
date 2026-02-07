# Lumen Tooling (Normative where stated)

> Note: The v1.0 core language spec is in `SPEC.md`. Tooling applies to both freestanding `core` projects and optional hosted projects.

## CLI (Normative)
- `lumen new <name>`
- `lumen run`
- `lumen build`
- `lumen test`
- `lumen fmt`
- `lumen lint`
- `lumen doc`
- `lumen add <pkg>`
- `lumen explain <E####>`
- `lumen cbindgen` (generate C headers for Lumen exports)
- `lumen bindgen` (import C headers as Lumen `extern` declarations)
- `lumen cimport` (convenience wrapper for deterministic C header import)

## Build system (Normative)
- Manifest: `lumen.toml`
- Lockfile: `lumen.lock`
- Builds are deterministic: pinned versions + checksums
- Incremental compilation and caching are required for conforming “developer” toolchains

### Manifest: C header imports (Normative)
To support incremental adoption in existing C codebases, toolchains must support a reproducible C header import configuration in `lumen.toml`.

`lumen cimport <header>` is the recommended user-facing workflow; it:
1. Discovers the platform’s effective C compilation environment for the chosen target (sysroot, built-in include paths, and predefined macros).
2. Runs the C preprocessor (`clang -E` or equivalent) and parses the resulting declarations (typically via libclang).
3. Generates a deterministic Lumen module containing `extern "C"` declarations and `@repr(C)` types (including unions, bitfields, and C varargs).
4. Records the exact inputs required to reproduce the import in `lumen.toml`.

#### `lumen.toml` schema (C import)
Toolchains must recognize a `[cimport]` table with one or more named imports:

```toml
[cimport.<name>]
headers = ["stdio.h"]          # required; one or more headers
output  = "src/c/stdio.lm"     # required; generated Lumen module path
target  = "x86_64-apple-darwin" # optional; defaults to active build target

# Reproducible preprocessing inputs (all optional, but if present are normative inputs):
include_dirs = ["/usr/include", "vendor/include"]
defines = ["FOO=1", "BAR"]
sysroot = "/path/to/sdk"       # if applicable on the host
clang = "clang"                # toolchain identifier or executable name/path
clang_args = ["-std=c11"]      # extra flags passed to the C frontend
```

Normative requirements:
- `headers`, `output`, and any listed preprocessing inputs are part of the build’s reproducibility contract.
- Generated output must be deterministic given the recorded inputs: stable ordering, stable formatting (within an Edition), and stable naming rules.
- `lumen build` must either:
  - fail with a clear diagnostic if a configured `output` is out of date, or
  - regenerate it automatically when running in an explicit “update” mode (toolchain-defined; recommended: `lumen cimport --update`).

## LSP (Normative for official distribution)
- go-to definition, references
- rename (semantic)
- code actions for fix-its
- inlay hints (types)
- format on save

## Formatter (Normative)
- Canonical, stable formatting within an Edition
- No stylistic knobs that change structure

## Linter (Non‑normative policy, but required tool)
- Correctness lints on by default
- Performance and style lints available
- `@allow/@deny` at module level

## C interop workflows (Normative for official toolchains)

### Header export (`lumen cbindgen`)
Official toolchains must be able to generate a C header for a Lumen package’s public C ABI surface:
- `extern "C"` functions
- `extern "C"` statics (declarations)
- `@repr(C)` structs and enums referenced by those signatures

The generated header must be stable within an Edition (formatting and naming), except for explicitly versioned changes to the exported API.

### Header import (`lumen bindgen`)
Official toolchains must be able to ingest a C header subset and produce Lumen `extern "C"` declarations.
The supported subset is toolchain-defined, but must include at minimum:
- function declarations
- C varargs function declarations (`...`)
- `struct` layouts for `@repr(C)`-compatible fields
- `union` layouts for `@repr(C)` unions
- C bitfields imported as `@bits(N)` fields
- integer and pointer types by width

`lumen cimport` is a convenience command that runs `bindgen` with a recorded preprocessing configuration and writes the result to a stable module path, updating `lumen.toml` as needed.

Non-normative recommendation:
- Toolchains should provide a format-string checker for common libc-style varargs APIs (e.g. `printf`-family), emitting warnings when arguments and format specifiers disagree.
