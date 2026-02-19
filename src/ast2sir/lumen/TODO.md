# Lumen TODO

- [ ] Add a raw CStr literal surface form (e.g. `cr"..."`) that maps to `core.lit.cstr.utf8z.raw` (no escape cooking)
  - Note: Lumen already supports raw UTF-8 strings (`r"..."` → `core.lit.string.utf8.raw`) and cooked CStr (`c"..."` → `core.lit.cstr.utf8z`).
