#!/usr/bin/env python3
"""Stress-test harness for ast2sir.

Pipeline per case:
  1) gritc     (.lm -> strict AST JSON)
  2) accept    (gl_ast_accept.mjs)
  3) ast2sir   (AST JSON -> SIR JSONL)
  4) verify    (sircc --verify-only) [optional]

All intermediates are stored under the repo-local ./tmp directory.

Typical use:
  python3 src/ast2sir/stress/run_stress.py
  python3 src/ast2sir/stress/run_stress.py --repeat 50 --shuffle --keep-ok

Exit codes:
  0 = all ok
  1 = at least one failure
  2 = missing tools / misconfiguration
"""

from __future__ import annotations

import argparse
import random
import shutil
import subprocess
import tempfile
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


def run(cmd: list[str], cwd: Path, timeout_s: int | None) -> StepResult:
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


def brief(text: str, max_lines: int = 10) -> str:
    lines = [ln.rstrip() for ln in (text or "").splitlines()]
    lines = [ln for ln in lines if ln.strip()]
    if not lines:
        return ""
    if len(lines) > max_lines:
        lines = lines[:max_lines] + ["…"]
    return "\n".join(lines)


def write_logs(dir_path: Path, stage: str, res: StepResult) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / f"{stage}.cmd.txt").write_text(" ".join(res.cmd) + "\n")
    (dir_path / f"{stage}.stdout.txt").write_text(res.stdout or "")
    (dir_path / f"{stage}.stderr.txt").write_text(res.stderr or "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--repeat", type=int, default=1, help="Repeat each case N times")
    ap.add_argument("--shuffle", action="store_true", help="Shuffle case order")
    ap.add_argument("--timeout", type=int, default=60, help="Per-step timeout seconds")
    ap.add_argument("--no-verify", action="store_true", help="Skip sircc --verify-only")
    ap.add_argument(
        "--only",
        choices=["all", "compile", "accept", "ast2sir", "sircc"],
        default="all",
        help="Run only a subset of stages",
    )
    ap.add_argument("--keep-going", action="store_true", help="Continue after failures")
    ap.add_argument("--keep-ok", action="store_true", help="Keep artifacts for successful runs too")
    ap.add_argument(
        "--cases",
        type=str,
        default=None,
        help="Optional glob (relative to stress/cases) to select cases, e.g. 'stress__*.lm'",
    )
    ap.add_argument(
        "--export-defects",
        type=str,
        default=None,
        help="Optional directory to copy handoff-ready repros for frontend defects (compile/accept failures)",
    )
    args = ap.parse_args()

    stress_dir = Path(__file__).resolve().parent
    # stress_dir = <repo>/src/ast2sir/stress
    # parents[2] = <repo>
    repo_root = stress_dir.parents[2]

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

    cases_dir = stress_dir / "cases"
    if not cases_dir.exists():
        print(f"error: missing cases dir: {cases_dir}")
        return 2

    if args.cases:
        lm_files = sorted(cases_dir.glob(args.cases))
    else:
        lm_files = sorted(cases_dir.rglob("*.lm"))

    if not lm_files:
        print("no .lm files found under stress/cases")
        return 0

    if args.shuffle:
        random.seed(0x51A7)
        random.shuffle(lm_files)

    tmp_root = Path(tempfile.mkdtemp(prefix="sir_lumen_stress.", dir=str(repo_tmp)))

    report_path = tmp_root / "REPORT.md"
    report_path.write_text(
        "# ast2sir stress report\n\n"
        f"tmp_root: {tmp_root}\n\n"
        "Stages:\n"
        "- compile = gritc (.lm -> strict AST JSON)\n"
        "- accept = gl_ast_accept.mjs\n"
        "- ast2sir = AST JSON -> SIR JSONL\n"
        "- sircc = sircc --verify-only\n\n"
    )

    export_defects_dir: Path | None = Path(args.export_defects).resolve() if args.export_defects else None
    if export_defects_dir:
        export_defects_dir.mkdir(parents=True, exist_ok=True)

    def report_append(text: str) -> None:
        with report_path.open("a") as f:
            f.write(text)

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
        for it in range(max(1, args.repeat)):
            run_dir = tmp_root / f"{lm.stem}.it{it:03d}"
            run_dir.mkdir(parents=True, exist_ok=True)

            lm_tmp = run_dir / lm.name
            try:
                shutil.copy2(lm, lm_tmp)
            except OSError:
                shutil.copyfile(lm, lm_tmp)

            ast_path = run_dir / f"{lm.stem}.ast.json"
            sir_path = run_dir / f"{lm.stem}.sir.jsonl"

            def fail(stage: str, res: StepResult) -> None:
                nonlocal any_fail
                any_fail = True
                write_logs(run_dir, stage, res)
                cmd_str = " ".join(res.cmd)
                msg = brief(res.stderr) or brief(res.stdout) or f"rc={res.rc}"
                print(f"FAIL  {lm.name}  it={it}  [{stage}]\n  dir: {run_dir}\n  {cmd_str}\n  {msg}\n")

                report_append(
                    f"## FAIL {lm.name} it={it} [{stage}]\n\n"
                    f"- dir: {run_dir}\n"
                    f"- rc: {res.rc}\n"
                    f"- cmd: `{cmd_str}`\n"
                    f"- logs: `{stage}.stderr.txt`, `{stage}.stdout.txt`, `{stage}.cmd.txt`\n\n"
                )
                b = msg.strip()
                if b:
                    report_append("### Brief\n\n```\n" + b + "\n```\n\n")

                # Frontend defects (gritc/accept) are useful to export for handoff.
                if export_defects_dir and stage in ("compile", "accept"):
                    ddir = export_defects_dir / stage
                    ddir.mkdir(parents=True, exist_ok=True)
                    stem = f"{lm.stem}.it{it:03d}"
                    # Copy the exact source we ran + the failing logs.
                    shutil.copyfile(lm_tmp, ddir / f"{stem}.lm")
                    for ext in ("cmd", "stdout", "stderr"):
                        src = run_dir / f"{stage}.{ext}.txt"
                        if src.exists():
                            shutil.copyfile(src, ddir / f"{stem}.{stage}.{ext}.txt")

            banner = f"RUN   {lm.name}  it={it}"
            if args.repeat > 1:
                banner += f"/{args.repeat}"
            print(banner)

            if want("compile"):
                gritc_out = run_dir / "gritc"
                gritc_out.mkdir(parents=True, exist_ok=True)
                r = run(
                    [
                        str(gritc),
                        "--pack",
                        str(pack),
                        "--outdir",
                        str(gritc_out),
                        str(lm_tmp),
                    ],
                    cwd=lumen_dir,
                    timeout_s=args.timeout,
                )
                if not r.ok:
                    fail("compile", r)
                    if not args.keep_going:
                        return 1
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
                    if not args.keep_going:
                        return 1
                    continue
                shutil.copyfile(asts[0], ast_path)

            if want("accept"):
                r = run(["node", str(accept), str(ast_path)], cwd=repo_root, timeout_s=args.timeout)
                if not r.ok:
                    fail("accept", r)
                    if not args.keep_going:
                        return 1
                    continue

            if want("ast2sir"):
                r = run([str(ast2sir), str(ast_path), "-o", str(sir_path)], cwd=repo_root, timeout_s=args.timeout)
                if not r.ok:
                    fail("ast2sir", r)
                    if not args.keep_going:
                        return 1
                    continue

            if not args.no_verify and want("sircc"):
                r = run([str(sircc), "--verify-only", str(sir_path)], cwd=repo_root, timeout_s=args.timeout)
                if not r.ok:
                    fail("sircc", r)
                    if not args.keep_going:
                        return 1
                    continue

            if not args.keep_ok:
                # Keep failures for repro, but delete successful per-iteration dirs.
                # (The top-level tmp_root is printed so it's still easy to inspect.)
                try:
                    shutil.rmtree(run_dir)
                except OSError:
                    pass

            print(f"OK    {lm.name}  it={it}")

    if any_fail:
        report_append("## Summary\n\n- result: FAIL\n")
        return 1
    report_append("## Summary\n\n- result: OK\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
