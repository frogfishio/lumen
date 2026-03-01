SHELL := /bin/sh

# Prefer the repo's canonical Lumen compiler.
# (The local ./bin/lumenc is a convenience copy and can drift/stale.)
REPO_ROOT ?= $(shell python3 -c 'from pathlib import Path; start=Path(r"$(CURDIR)").resolve(); root=next((p for p in ([start]+list(start.parents)) if (p/"VERSION").exists() and (p/"src").exists()), start); print(root)')

LUMEN_DIR ?= $(REPO_ROOT)/src/lang/lumen
BIN ?= $(LUMEN_DIR)/bin/lumenc

# Tool resolution (preferred order): Makefile build -> dist bundle.
AST2SIR ?= $(shell for p in \
	"$(REPO_ROOT)/src/ast2sir/build/ast2sir" \
	"$(REPO_ROOT)/dist/bin/macos/ast2sir" \
	"$(REPO_ROOT)/dist/bin/macos-arm64/ast2sir" \
	; do [ -x "$$p" ] && echo "$$p" && exit 0; done; exit 0)
SIRCC ?= $(shell for p in \
	"$(REPO_ROOT)/src/sircc/build/sircc" \
	"$(REPO_ROOT)/dist/bin/macos/sircc" \
	"$(REPO_ROOT)/dist/bin/macos-arm64/sircc" \
	; do [ -x "$$p" ] && echo "$$p" && exit 0; done; exit 0)
OUT := out/dev
MANIFEST := $(OUT)/manifest.json
SIR := $(OUT)/app.sir.jsonl
OBJ := $(OUT)/app.o
SHIM_LUMEN_OBJ := $(OUT)/shim_lumen.o
EXE := $(OUT)/app.exe

APP_MANIFEST := app/package.toml
PKG_ROOT := packages

.PHONY: all build sir exe run clean bootstrap

all: build

build:
	@test -x "$(BIN)" || (echo "error: missing executable: $(BIN)" 1>&2; echo "hint: copy lumenc into ./bin or run: make bootstrap" 1>&2; exit 1)
	@mkdir -p "$(OUT)"
	@python3 -c 'import subprocess,time,sys; cmd=[r"$(BIN)","--verbose","--package",r"$(APP_MANIFEST)","--packages",r"$(PKG_ROOT)","--out-dev",r"$(OUT)"]; t0=time.perf_counter(); rc=subprocess.call(cmd); dt=int((time.perf_counter()-t0)*1000); print("ast $(APP_MANIFEST) %dms"%dt, file=sys.stderr); sys.exit(rc)'

sir: build
	@test -x "$(AST2SIR)" || (echo "error: missing executable: $(AST2SIR)" 1>&2; echo "hint: build it from the repo root: make -C src/ast2sir" 1>&2; exit 1)
	@test -f "$(MANIFEST)" || (echo "error: missing manifest: $(MANIFEST)" 1>&2; exit 1)
	@"$(AST2SIR)" --verbose --verify-producer --diagnostics-out "$(OUT)/ast2sir.diag.jsonl" --manifest "$(MANIFEST)" -o "$(SIR)"

exe: sir
	@test -x "$(SIRCC)" || (echo "error: missing executable: $(SIRCC)" 1>&2; echo "hint: build it from the repo root: make -C src/sircc" 1>&2; exit 1)
	@python3 -c 'import subprocess,time,sys; cmd=[r"$(SIRCC)",r"$(SIR)","--emit-obj","-o",r"$(OBJ)"]; t0=time.perf_counter(); rc=subprocess.call(cmd); dt=int((time.perf_counter()-t0)*1000); print("lower $(SIR) %dms"%dt, file=sys.stderr); sys.exit(rc)'
	@clang -c packages/lumen/lib/shim.c -o "$(SHIM_LUMEN_OBJ)"
	@clang "$(OBJ)" "$(SHIM_LUMEN_OBJ)" -o "$(EXE)"

run: exe
	@st=0; "$(EXE)"; st=$$?; echo "ok: exit=$$st"; test $$st -eq 2

clean:
	@rm -rf out

# Convenience for use when this folder lives inside the Grit repo checkout.
# It generates `./bin/lumenc` using the repo's `grit` tool and Lumen spec.
bootstrap:
	@mkdir -p bin
	@test -x ../src/grit/grit || (echo "error: ../src/grit/grit not found/executable (build it first: make -C ../src/grit)" 1>&2; exit 1)
	@test -f ../src/4_ast/cert/cases/lumen/lumen.grit || (echo "error: ../src/4_ast/cert/cases/lumen/lumen.grit not found" 1>&2; exit 1)
	@../src/grit/grit monomorphize ../src/4_ast/cert/cases/lumen/lumen.grit --out ./bin/lumenc
	@echo "ok: wrote ./bin/lumenc"

