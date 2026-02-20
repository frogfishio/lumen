SHELL := /bin/sh

BIN := bin/lumenc
OUT := out/dev

APP_MANIFEST := app/package.toml
PKG_ROOT := packages

.PHONY: all build clean bootstrap

all: build

build:
	@test -x "$(BIN)" || (echo "error: missing executable: $(BIN)" 1>&2; echo "hint: copy lumenc into ./bin or run: make bootstrap" 1>&2; exit 1)
	@mkdir -p "$(OUT)"
	@"$(BIN)" --package "$(APP_MANIFEST)" --packages "$(PKG_ROOT)" --out-dev "$(OUT)"

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

