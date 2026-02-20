# Lumen Design Rationale (Non‑normative)

## Why “new C”
The modern world still runs on C ABIs, raw pointers, and layout-defined data. C is unbeatable as a portability layer,
but its ergonomics and safety model are frozen in time.

Lumen aims to keep C’s strengths (freestanding, tight codegen, ABI compatibility) while offering a 21st-century developer experience.

## Safe by default, unsafe when explicit
Undefined behavior should be something you opt into and localize. Lumen makes dangerous operations explicit via `unsafe`.

## Small language, big tooling
A “C replacement” lives or dies on usability: diagnostics, build UX, and interop workflows matter as much as syntax.

## Optional hosted world
Kernel and embedded code need `core`. Services may want richer libraries. Lumen is designed so hosted facilities stay optional.
