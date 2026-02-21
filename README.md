# Lumen — C with hindsight

Not better Rust. Not better Zig. Not better C.

Lumen is what K&R might have written if they started C today.

- Still manual memory 
- Still raw pointers & unsafe blocks  
- Still extern "C" interop  
- But with blocks, defer, match, shadowing, explicit unsafe, generics (optional), traits (optional), verifiable IR (SIR), deterministic execution, capability safety

Safety? No. Not by default.  
It's low-level programming with low-level access.  
You can shoot yourself in the foot — but the footgun has a bright orange "unsafe" label.

Why bother?

Because every "better C" tried to be **better** — and in doing so, took away the one thing C was best at:  
talking to the machine without asking permission.

Lumen doesn't try to be better.  
It tries to be **less embarrassing**.

It started with BCPL → B → C → [P for all the pretenders] → finally L.

L = Lumen = C with hindsight.

That's all it is.  
That's all it will ever be.

Because we love C.  
C gets the job done.

So does Lumen.

## License

The Lumen compiler is free software licensed under the GNU General Public License version 3 or later.

This license applies to the compiler itself and its source code. Programs compiled with Lumen are not affected by this license; they belong to you, just like with GCC.

See LICENSE for the full license text.

## Building

To build the Lumen compiler:

```sh
make build
```

This will generate `bin/lumenc`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Security

See [SECURITY.md](SECURITY.md)

## Contact

Alexander R. Croft <alex@frogfish.io>