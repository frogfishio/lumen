#pragma once

#include <stdint.h>

typedef struct CFlags {
  uint32_t a : 1;
  uint32_t b : 3;
  uint32_t rest;
} CFlags;

typedef union CUnion4 {
  uint32_t a;
  uint8_t b[4];
} CUnion4;
