**Lumen Modules + `use` (Cheat Sheet, core v1.0)**

Modules

- Every source file is in a module.
- A file may start (after comments/whitespace) with a file-module declaration:

```lumen
mod steve;
mod a::b::c;
```

- Defaults (hosted packages):
  - `src/main.lm` defaults to `mod main;`
  - `src/lib.lm` defaults to `mod lib;`
  - Any other `src/*.lm` must start with `mod ...;` (error `E0510` if missing)

Inline submodules

```lumen
mod main;

mod util {
  pub fn add(a: I32, b: I32) -> I32 { a + b }

  pub mod fmt {
    use super::add;
    pub fn banner() -> I32 { add(1 as I32, 2 as I32) }
  }
}
```

- `mod name { ... }` defines a child module.
- `super::` inside an inline module refers to the parent module.
- A parent module cannot have both:
  - an inline `mod x { ... }`, and
  - a file module child `x`
  (same child name) — that’s an error.

Entry point

- Hosted binary entry point is `main::main`.
- Allowed signatures:

```lumen
mod main;

fn main() {
  // exit code 0
}

fn main() -> I32 {
  0 as I32 // exit code = returned value
}
```

`use` forms

Import a module (binds the module name):

```lumen
mod main;

use util;        // binds `util`
use util as U;   // binds `U`
```

Import an item or submodule from a module:

```lumen
mod main;

use util::add;          // binds `add`
use util::Point as P;   // binds `P`
use util::fmt;          // binds `fmt` (submodule)
```

Glob import:

```lumen
mod main;

use util::*;    // provides all public names of util (lazy; see below)
```

Grouped list sugar:

```lumen
mod main;

use util { add, fmt, Point as P };   // sugar for util::{...}
```

Name binding + collision rules (the important part)

Rule 1: One name → one symbol (no kind overloading)

```lumen
mod main;

struct Foo { x: I32 }
fn Foo() -> I32 { 1 as I32 } // ERROR: Foo already bound (type/value don’t get separate namespaces)
```

Rule 2: Local definitions win, imports never override

```lumen
mod main;

mod util { pub fn log() -> I32 { 1 as I32 } }

fn log() -> I32 { 0 as I32 }
use util::log; // ERROR (E0511): conflicts with local `log`
```

Rule 3: Explicit imports must be conflict-free

Idempotent OK:

```lumen
mod main;

mod util { pub fn add() -> I32 { 1 as I32 } }

use util::add;
use util::add; // OK (same symbol)
```

Different target is an error; alias fixes it:

```lumen
mod main;

mod util { pub fn add() -> I32 { 1 as I32 } }
mod math { pub fn add() -> I32 { 2 as I32 } }

use util::add;
use math::add;        // ERROR (E0512): `add` already bound
use math::add as madd; // OK
```

Rule 4: Globs are “lazy providers”, not eager binders

- Lookup order for unqualified `x`:
  1) local definitions
  2) explicit imports (including `use util;`)
  3) glob candidates
  4) not found

Ambiguous only when you use the name:

```lumen
mod main;

mod util { pub fn add() -> I32 { 1 as I32 } }
mod math { pub fn add() -> I32 { 2 as I32 } }

use util::*;
use math::*;

fn main() -> I32 {
  let _ = add(); // ERROR (E0513): ambiguous util::add vs math::add
  0 as I32
}
```

Explicit import makes it stable:

```lumen
mod main;

mod util { pub fn add() -> I32 { 1 as I32 } }
mod math { pub fn add() -> I32 { 2 as I32 } }

use util::*;
use math::*;
use util::add;

fn main() -> I32 {
  let _ = add(); // OK (explicit wins; glob candidates ignored)
  0 as I32
}
```

Rule 5: Importing module names collides like everything else

```lumen
mod main;

use util;
use other::util; // ERROR unless aliased
```

Rule 6: Duplicate public exports inside a module are illegal

```lumen
mod main;

mod m {
  pub fn f() -> I32 { 1 as I32 }
  pub fn f() -> I32 { 2 as I32 } // ERROR (E0514)
}
```