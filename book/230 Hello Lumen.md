# Hello Lumen

Okay, now that I most likely put you off the language, let me show you how things are really done.

```lumen
use lumen::io;

fn main() {
    puts("Hello Lumen.");
}
```

Yes, and that’s it.

What changed?

We’re now using the Lumen standard library. One `use lumen::io;` and suddenly everything just works.

Let’s have a look at the lumen stdlib:

```lumen
extern "C" unsafe fn lf_puts(s: Ptr[U8]) -> I32;
extern "C" unsafe fn lf_write_stdout(buf: Usize, len: Usize) -> I32;
extern "C" unsafe fn lf_write_stderr(buf: Usize, len: Usize) -> I32;
extern "C" unsafe fn lf_read_stdin(buf: Usize, cap: Usize) -> I32;

pub unsafe fn puts(s: Ptr[U8]) -> I32 {
  lf_puts(s)
}

pub unsafe fn write_stdout(buf: Usize, len: Usize) -> I32 {
  lf_write_stdout(buf, len)
}

pub unsafe fn write_stderr(buf: Usize, len: Usize) -> I32 {
  lf_write_stderr(buf, len)
}

pub unsafe fn read_stdin(buf: Usize, cap: Usize) -> I32 {
  lf_read_stdin(buf, cap)
}
```

Looks familiar?

