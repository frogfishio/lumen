#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Canonical, closed semantics vocabularies for shipped GL artifacts.
//
// These IDs are the "semantic commit" layer: downstream lowering should parse the
// strings once at the boundary and operate on enums (not magic strings).

typedef enum GlBuiltinTypeId {
    GL_BUILTIN_TYPE__INVALID = 0,

    GL_BUILTIN_TYPE_i8,
    GL_BUILTIN_TYPE_i32,
    GL_BUILTIN_TYPE_i64,
    GL_BUILTIN_TYPE_u8,
    GL_BUILTIN_TYPE_u32,
    GL_BUILTIN_TYPE_u64,
    GL_BUILTIN_TYPE_f32,
    GL_BUILTIN_TYPE_f64,
    GL_BUILTIN_TYPE_bool,
    GL_BUILTIN_TYPE_void,

    GL_BUILTIN_TYPE_ptr,
    GL_BUILTIN_TYPE_slice,
    GL_BUILTIN_TYPE_bytes,
    GL_BUILTIN_TYPE_string_utf8,
    GL_BUILTIN_TYPE_cstr,

    GL_BUILTIN_TYPE__COUNT
} GlBuiltinTypeId;

typedef enum GlOpId {
    GL_OP__INVALID = 0,

    GL_OP_core_assign,
    GL_OP_core_bool_or_sc,
    GL_OP_core_bool_and_sc,

    GL_OP_core_add,
    GL_OP_core_sub,
    GL_OP_core_mul,
    GL_OP_core_div,
    GL_OP_core_rem,

    GL_OP_core_shl,
    GL_OP_core_shr,
    GL_OP_core_bitand,
    GL_OP_core_bitor,
    GL_OP_core_bitxor,

    GL_OP_core_eq,
    GL_OP_core_ne,
    GL_OP_core_lt,
    GL_OP_core_lte,
    GL_OP_core_gt,
    GL_OP_core_gte,

    GL_OP__COUNT
} GlOpId;

typedef enum GlCastConvId {
    GL_CAST_CONV__INVALID = 0,

    GL_CAST_CONV_core_cast_intlit_to_int,
    GL_CAST_CONV_core_cast_int_to_int,
    GL_CAST_CONV_core_cast_int_to_ptr,
    GL_CAST_CONV_core_cast_ptr_to_int,

    GL_CAST_CONV__COUNT
} GlCastConvId;

size_t gl_builtin_type_id_count(void);
const char* gl_builtin_type_id_to_string(GlBuiltinTypeId v);
bool gl_builtin_type_id_from_string(const char* s, GlBuiltinTypeId* out);

size_t gl_op_id_count(void);
const char* gl_op_id_to_string(GlOpId v);
bool gl_op_id_from_string(const char* s, GlOpId* out);

size_t gl_cast_conv_id_count(void);
const char* gl_cast_conv_id_to_string(GlCastConvId v);
bool gl_cast_conv_id_from_string(const char* s, GlCastConvId* out);

#ifdef __cplusplus
}
#endif
