.PHONY: all build clean

all: build

build:
	mkdir -p bin
	./ext/bin/Mach-O/grit monomorphize src/lumen.grit --out bin/lumenc

clean:
	rm -f bin/lumenc