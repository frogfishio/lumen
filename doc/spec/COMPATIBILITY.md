# Compatibility, Editions, and Versioning

## SemVer for packages (Normative)
- MAJOR bumps for breaking public API changes

## Editions (Normative)
- Breaking language changes only via Editions
- Edition declared in `lumen.toml`
- `lumen fix --edition <next>` provides automated migrations

## Deprecations (Normative)
- `@deprecated("message")` warns for at least one minor cycle
- Removal only in next MAJOR or next Edition
