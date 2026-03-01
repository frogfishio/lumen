# `lumenc` manual (monomorphic Lumen compiler CLI)

`lumenc` is the **monomorphic** (single-language) compiler driver for **Lumen** produced by this repo.

It is built from the canonical Grit pipeline up to the **Stage 4 strict AST boundary** and module resolution:

```
source (.lm) -> Stage2 ParseTree -> Stage4 strict AST -> modresolve -> artifacts
```

`lumenc` embeds the Lumen `pack.json` inside the executable (no `--pack`). This makes it suitable for “production CLI” distribution and editor/IDE integrations.

## What `lumenc` is (and is not)

- `lumenc` **is**: a production-oriented front-end that produces strict AST + module resolution artifacts.
- `lumenc` **is not**: a full native code compiler; further lowering/codegen is done by downstream projects.
- `lumenc` **does not** accept surface-language special cases: all semantics come from `lumen.grit` + canonical intrinsics.

## Install / build

### 1) Build prerequisites

Build the Rust runtime library (required by pack execution):

```sh
make -C src/lib out
```

Build `grit` (the pack compiler + monomorphizer):

```sh
make -C src/grit
```

### 2) Produce `lumenc`

From the repo root:

```sh
./src/grit/grit monomorphize src/4_ast/cert/cases/lumen/lumen.grit
```

This writes `./lumenc` by default.

Choose an explicit output path:

```sh
./src/grit/grit monomorphize src/4_ast/cert/cases/lumen/lumen.grit --out /usr/local/bin/lumenc
```

## Usage (compile files)

Compile one or more `.lm` files as a **closed world** (imports must resolve within the provided set):

```sh
lumenc --outdir out/app src/main.lm src/util.lm
```

Optionally validate an entrypoint:

```sh
lumenc --outdir out/app --start main:main src/main.lm src/util.lm
```

Help and version:

```sh
lumenc --help
lumenc --version
```

## Package mode (compile a `package.toml`)

Package mode exists to build a closed-world unit set from:
- your `package.toml`
- an on-disk dependency tree (one directory per dependency)

Then it runs the same canonical pipeline as file mode.

Minimal invocation:

```sh
lumenc \
  --package path/to/package.toml \
  --packages /path/to/packages_root \
  --out-dev out/dev
```

Optional dist output (same artifacts, separate directory):

```sh
... --out-dist out/dist
```

### Dependency layout on disk (today)

Given a dependency name `hello`, `lumenc` searches each `--packages` root for:

```
<packages_root>/hello/package.toml
```

`--packages` is repeatable; the first root that contains the dependency wins.

### `package.toml` support (today)

`package.toml` is parsed by a minimal purpose-built reader (not full TOML). Supported fields:

```toml
[package]
name = "app"
dialect = "lumen/1.0.0"

[source]
root = "src"

[dependencies]
hello = { version = "0.1.0" }  # the value is currently ignored; the key matters
```

Notes:
- `source.root` is required.
- Dialect is currently enforced as `lumen/1.0.0` in package mode.

## Outputs

On success, `--outdir` / `--out-dev` contains:

- `*.ast.json` — one strict AST per unit (sanitized filename prefix)
- `modules.json` — module resolution output
- `manifest.json` — summary manifest (written last as a completion signal)

If `--out-dist` is provided (package mode), the same trio is also written into that directory.

### Manifest (`manifest.json`) high level

Always present:
- `tool`, `version`, `pack` (always `"@embedded"`), `start`, `mode`
- `sources[]`
- `asts[]` (maps source → ast path)
- `modules` path

Package mode adds (high level):
- package identity (`name`, `dialect`, `source_root`)
- dependency names (`dependencies[]`) and resolved paths (`deps_resolved{}`)
- package roots (`package_roots[]`)
- unit ownership metadata (`units[]`)

## Diagnostics and exit codes

Exit status:
- `0` success (outputs committed)
- `1` compile failure (no outputs committed; optional diagnostics may be written)
- `2` usage / driver error (invalid flags, missing files, IO failures)

Diagnostics JSON:
- If `--diag-out <path>` is provided, and module resolution fails, `lumenc` writes a diagnostics JSON file and does **not** commit outputs.
- If module resolution succeeds, `--diag-out` is ignored and any created diagnostics file is removed.

## CLI reference

File mode:
- `--outdir DIR` (default: `out/gritcm`)
- `--start Mod:Name` (optional)
- `--manifest PATH` (optional; default `<outdir>/manifest.json`)
- `<src1> [src2 ...]`

Package mode:
- `--package PATH` (required)
- `--packages DIR` (required; repeatable)
- `--out-dev DIR` (required)
- `--out-dist DIR` (optional)
- `--start Mod:Name` (optional)
- `--manifest PATH` (optional; defaults to `<out-dev>/manifest.json`)
- `--diag-out PATH` (optional; only for in-process modresolve failures)

Global:
- `-h`, `--help`
- `--version`

## Recommended workflows

### Editor / IDE integration

The intended editor-facing contract is:
- run `lumenc` on the current workspace unit set (files or package mode)
- consume `manifest.json` as the “build complete” signal
- read `modules.json` + `*.ast.json` outputs
- on failure, read `--diag-out` diagnostics JSON (if configured)

### CI

In CI, treat:
- non-zero exit as failure
- `manifest.json` existence as “artifact commit happened”

## Troubleshooting

- “missing embedded pack payload”: the `lumenc` binary was not produced via `grit monomorphize` (or the payload was stripped).
- “imports not found”: file mode is closed-world; add the imported file(s) to the command line or use package mode.

