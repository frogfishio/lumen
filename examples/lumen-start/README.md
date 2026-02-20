# lumen-start

Self-contained starter layout for a small Lumen workspace using `lumenc` package mode.

## Quickstart

1) Put a `lumenc` binary at `./bin/lumenc` (or run `make bootstrap` if you are inside the Grit repo).
2) Build:

```sh
make
```

Outputs are written to `./out/dev`.

## What this contains

- `app/` — a tiny binary package that depends on:
  - `lumen` — a minimal prelude-style package (e.g. `Option`, `Result`)
  - `hello` — a small example dependency
- `packages/` — the dependency roots for `--packages`

## Notes

- No implicit prelude is assumed: everything is imported explicitly or referenced by module path.
- This is intended to be used as a starting point.

