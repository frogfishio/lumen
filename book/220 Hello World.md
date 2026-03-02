# Hello World

This has become somewhat of a tradition when learning programming languages, and who am I to break with it? Hence:

```lumen
extern "C" unsafe fn puts(s: CStr) -> I32;

fn main() {
  unsafe {
    puts(c"Hello World");
  }
}
```


Wait, what?

Shocking, isn't it? Let me explain.

- Lumen comes as a standalone compiler, no batteries included, so if you want to use libc, you'll have to link it in, and declare it
- But, why is it unsafe? Because it is.
- Does lumen really come without a library? No, it comes with a good stdlib, but that's optional.
- What about the `c` before the string quotes?:

- c tells the compiler, that this is a c-compatible string.
- lumen is natively UTF8, so "Hello World" is not ASCII. It is Unicode
- There are also b"Hello", for byte ptr. r"hello" for raw UTF string that won't interpret escapes.

- what if I want to have a raw C string? Simple use b"hello world" and add zero at the end.

