#include "layouts.h"

#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <stdarg.h>

// Size/alignment/offset probes
uintptr_t c_sizeof_flags(void) { return (uintptr_t)sizeof(CFlags); }
uintptr_t c_alignof_flags(void) { return (uintptr_t)_Alignof(CFlags); }
uintptr_t c_offsetof_flags_rest(void) { return (uintptr_t)offsetof(CFlags, rest); }

uintptr_t c_sizeof_union4(void) { return (uintptr_t)sizeof(CUnion4); }
uintptr_t c_alignof_union4(void) { return (uintptr_t)_Alignof(CUnion4); }

// Byte-pack helpers
void c_pack_flags(uint32_t a, uint32_t b, uint32_t rest, uint8_t* out, uintptr_t out_len) {
  if (out == NULL) return;
  if (out_len < (uintptr_t)sizeof(CFlags)) return;
  CFlags f;
  memset(&f, 0, sizeof(f));
  f.a = a;
  f.b = b;
  f.rest = rest;
  memcpy(out, &f, sizeof(f));
}

void c_pack_union4_a(uint32_t a, uint8_t* out, uintptr_t out_len) {
  if (out == NULL) return;
  if (out_len < (uintptr_t)sizeof(CUnion4)) return;
  CUnion4 u;
  memset(&u, 0, sizeof(u));
  u.a = a;
  memcpy(out, &u, sizeof(u));
}

void c_pack_union4_b(const uint8_t in4[4], uint8_t* out, uintptr_t out_len) {
  if (out == NULL) return;
  if (out_len < (uintptr_t)sizeof(CUnion4)) return;
  CUnion4 u;
  memset(&u, 0, sizeof(u));
  if (in4 != NULL) memcpy(u.b, in4, 4);
  memcpy(out, &u, sizeof(u));
}

void c_copy_bytes(const void* src, uint8_t* out, uintptr_t n) {
  if (src == NULL || out == NULL) return;
  memcpy(out, src, (size_t)n);
}

// Varargs calling-convention check:
// Reads: int32 (promoted), void*, uint64. Returns a combined value.
uint64_t c_varargs_mix(const void* ignored, ...) {
  (void)ignored;
  va_list ap;
  va_start(ap, ignored);
  int32_t x = va_arg(ap, int32_t);
  void* p = va_arg(ap, void*);
  uint64_t y = va_arg(ap, uint64_t);
  va_end(ap);

  // Mix pointer bits in a stable way within a process.
  uintptr_t pi = (uintptr_t)p;
  return (uint64_t)(uint32_t)x ^ (uint64_t)pi ^ (y << 1);
}

