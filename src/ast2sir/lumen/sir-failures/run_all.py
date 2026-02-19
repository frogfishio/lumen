#!/usr/bin/env python3
"""Batch-run the Lumen→AST→ACCEPT→SIR pipeline over lumen/sir-failures/*.lm.

Default stages:
  - compile (.lm → strict AST)
  - accept  (gl_ast_accept)
  - lower   (ast2sir → SIR JSONL)
  - verify  (sircc --verify-only)

Usage:
  python3 run_all.py            # run all stages
  python3 run_all.py --no-verify
  python3 run_all.py --only ast2sir
  python3 run_all.py --only sircc

Exit codes:
  0 = all ok
  1 = at least one failure
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import shutil
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class StepResult:
    ok: bool
    stage: str
    cmd: list[str]
    stdout: str
    stderr: str
    rc: int


def run(cmd: list[str], cwd: Path, timeout_s: int | None = None) -> StepResult:
    try:
        p = subprocess.run(
            cmd,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_s,
        )
        return StepResult(
            ok=(p.returncode == 0),
            stage="",
            cmd=cmd,
            stdout=p.stdout,
            stderr=p.stderr,
            rc=p.returncode,
        )
    except subprocess.TimeoutExpired as e:
        return StepResult(
            ok=False,
            stage="",
            cmd=cmd,
            stdout=e.stdout or "",
            stderr=(e.stderr or "") + f"\nTIMEOUT after {timeout_s}s\n",
            rc=124,
        )


def brief_err(text: str, max_lines: int = 6) -> str:
    lines = [ln.rstrip() for ln in (text or "").splitlines() if ln.strip()]
    if not lines:
        return ""
    lines = lines[:max_lines]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-verify", action="store_true", help="Skip sircc --verify-only")
    ap.add_argument(
        "--only",
        choices=["all", "compile", "accept", "ast2sir", "sircc"],
        default="all",
        help="Run only a subset of stages",
    )
    ap.add_argument("--timeout", type=int, default=60, help="Per-step timeout seconds")
    args = ap.parse_args()

    failures_dir = Path(__file__).resolve().parent
    repo_root = failures_dir.parents[3]  # .../src/ast2sir/lumen/sir-failures/..

    # Keep intermediates inside the repo (./tmp) to make debugging easy and to
    # avoid reliance on OS-level temp locations.
    repo_tmp = repo_root / "tmp"
    repo_tmp.mkdir(parents=True, exist_ok=True)

    lumen_dir = repo_root / "src/ast2sir/lumen"
    gritc = lumen_dir / "bin/gritc"
    pack = lumen_dir / "packs/lumen.pack.json"
    accept = repo_root / "src/ast2sir/tools/gl_ast_accept.mjs"
    ast2sir = repo_root / "build/src/ast2sir/ast2sir"
    sircc = repo_root / "build/src/sircc/sircc"

    needed = [gritc, pack, accept, ast2sir]
    if not args.no_verify:
        needed.append(sircc)

    missing = [p for p in needed if not p.exists()]
    if missing:
        print("error: missing required tools:")
        for p in missing:
            print(f"  - {p}")
        return 2

    lm_files = sorted([p for p in failures_dir.iterdir() if p.suffix == ".lm"])
    if not lm_files:
        print("no .lm files found")
        return 0

    tmp_root = Path(tempfile.mkdtemp(prefix="sir_lumen_failures.", dir=str(repo_tmp)))

    def want(stage: str) -> bool:
        if args.only == "all":
            return True
        if args.only == "ast2sir":
            return stage in ("compile", "accept", "ast2sir")
        if args.only == "sircc":
            return stage in ("compile", "accept", "ast2sir", "sircc")
        return args.only == stage

    any_fail = False
    print(f"tmp: {tmp_root}")

    for lm in lm_files:
        stem = lm.stem
        ast_path = tmp_root / f"{stem}.ast.json"
        sir_path = tmp_root / f"{stem}.sir.jsonl"
        lm_tmp = tmp_root / f"{stem}.lm"

        # ast2sir optionally loads a companion `<name>.lm` next to `<name>.ast.json`
        # to support span-based recovery (e.g. `use ... as ...` aliases). Keep a copy
        # of the source in the tmp dir so that behavior works for generated ASTs.
        try:
            shutil.copy2(lm, lm_tmp)
        except OSError:
            pass

        def fail(stage: str, res: StepResult) -> None:
            nonlocal any_fail
            any_fail = True
            cmd_str = " ".join(res.cmd)
            msg = brief_err(res.stderr) or brief_err(res.stdout) or f"rc={res.rc}"
            print(f"FAIL  {lm.name}  [{stage}]\n  {cmd_str}\n  {msg}\n")

        print(f"RUN   {lm.name}")

        if want("compile"):
            gritc_out = tmp_root / f"{stem}.gritc"
            gritc_out.mkdir(parents=True, exist_ok=True)
            r = run(
                [
                    str(gritc),
                    "--pack",
                    str(pack),
                    "--outdir",
                    str(gritc_out),
                    str(lm),
                ],
                cwd=lumen_dir,
                timeout_s=args.timeout,
            )
            if not r.ok:
                fail("compile", r)
                continue

            asts = sorted(gritc_out.glob("*.ast.json"))
            if not asts:
                fail(
                    "compile",
                    StepResult(
                        ok=False,
                        stage="",
                        cmd=r.cmd,
                        stdout=r.stdout,
                        stderr=r.stderr + "\n(no *.ast.json produced)",
                        rc=3,
                    ),
                )
                continue
            shutil.copyfile(asts[0], ast_path)

        if want("accept"):
            r = run(["node", str(accept), str(ast_path)], cwd=repo_root, timeout_s=args.timeout)
            if not r.ok:
                fail("accept", r)
                continue

        if want("ast2sir"):
            r = run([str(ast2sir), str(ast_path), "-o", str(sir_path)], cwd=repo_root, timeout_s=args.timeout)
            if not r.ok:
                fail("ast2sir", r)
                continue

        if not args.no_verify and want("sircc"):
            r = run([str(sircc), "--verify-only", str(sir_path)], cwd=repo_root, timeout_s=args.timeout)
            if not r.ok:
                fail("sircc", r)
                continue

        print(f"OK    {lm.name}")

    if any_fail:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
