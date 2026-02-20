# `cimport` demo

This example shows how a project can record a reproducible C header import in `lumen.toml`.

- The configuration lives in `lumen.toml` under `[cimport.<name>]`.
- Running `lumen cimport --update` (toolchain-defined) should generate `src/c/stdio.lm` based on the recorded preprocessing inputs.

Files:
- `lumen.toml` — manifest showing `[cimport.libc_stdio]` for `stdio.h`
