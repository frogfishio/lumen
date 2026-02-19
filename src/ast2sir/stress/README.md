# STRESS

- This folder contains a stress harness for `ast2sir` plus a growing set of
	intentionally gnarly Lumen programs.

## Goal

- Write hard Lumen code
- Compile to strict AST JSON (`gritc`)
- Validate the AST (`gl_ast_accept.mjs`)
- Lower to SIR (`ast2sir`)
- Optionally verify SIR (`sircc --verify-only`)

The harness keeps intermediates under the repo-local `./tmp/` to make failures
easy to reproduce.

## Usage

From the repo root:

- Run all stress cases once:
	- `python3 src/ast2sir/stress/run_stress.py`
- Repeat each case many times (useful for catching nondeterminism):
	- `python3 src/ast2sir/stress/run_stress.py --repeat 50 --shuffle --keep-ok`
- Run only one case:
	- `python3 src/ast2sir/stress/run_stress.py --cases 'stress__unsafe_*'`
- Skip SIR verification:
	- `python3 src/ast2sir/stress/run_stress.py --no-verify`

- Export frontend defects for handoff:
	- `python3 src/ast2sir/stress/run_stress.py --export-defects ./tmp/stress_defects`

On failure, the harness prints a per-run directory under `./tmp/sir_lumen_stress.*`
that contains the `.ast.json`, `.sir.jsonl`, and stage logs.

It also writes a top-level `REPORT.md` inside the temp root.

If you want to hand off frontend defects (gritc compile errors or strict-accept failures),
use `--export-defects <dir>` to copy the `.lm` plus failing logs into a stable folder.

## Adding cases

- Put `.lm` files under `src/ast2sir/stress/cases/`.
- Prefer small, surgical programs that combine multiple features (control flow,
	unsafe ops, modules/paths, FFI, casts) to maximize coverage.

## Frontend defects

- Repros for known frontend strict-AST issues live under `src/ast2sir/stress/frontend_defects/`.
- These are **not** run by default (the harness only scans `cases/`), so backend stress runs stay green.

## Backend defects

- Repros for known `ast2sir` gaps live under `src/ast2sir/stress/backend_defects/`.
- These are also **not** run by default.

## TODO

- Add more cases that target not-yet-covered lowering paths.
- Add a “minimize failing case” helper (optional).