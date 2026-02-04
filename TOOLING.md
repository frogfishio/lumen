# Lumen Tooling (Normative where stated)

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

## Build system (Normative)
- Manifest: `lumen.toml`
- Lockfile: `lumen.lock`
- Builds are deterministic: pinned versions + checksums
- Incremental compilation and caching are required for conforming “developer” toolchains

## LSP (Normative for official distribution)
- go-to definition, references
- rename (semantic)
- code actions for fix-its
- inlay hints (types + effects)
- format on save

## Formatter (Normative)
- Canonical, stable formatting within an Edition
- No stylistic knobs that change structure

## Linter (Non‑normative policy, but required tool)
- Correctness lints on by default
- Performance and style lints available
- `@allow/@deny` at module level
