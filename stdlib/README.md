# lumen-start

Self-contained starter layout for a small Lumen workspace using `lumenc` package mode.

## Quickstart

1) Put a `lumenc` binary at `./bin/lumenc` (or run `make bootstrap` if you are inside the Grit repo).
2) Build:

```sh
make
```

3) Run:

```sh
make run
```

This demo returns `2` (it computes `1 + 1`).

Outputs are written to `./out/dev`.

## What this contains

- `app/` — a tiny binary package that depends on:
  - `lumen` — a minimal prelude-style package (e.g. `Option`, `Result`)
  - `hello` — a small example dependency
- `packages/` — the dependency roots for `--packages`

## Notes

- No implicit prelude is assumed: everything is imported explicitly or referenced by module path.
- This is intended to be copied out of the Grit repo and used as a starting point.

