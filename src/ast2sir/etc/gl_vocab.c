#include "gl_vocab.h"

#include <string.h>

static const char* const GL_BUILTIN_TYPE_ID_STRS[] = {
    NULL,

    "i8",
    "i32",
    "i64",
    "u8",
    "u32",
    "u64",
    "f32",
    "f64",
    "bool",
    "void",

    "ptr",
    "slice",
    "bytes",
    "string.utf8",
    "cstr",
};

static const char* const GL_OP_ID_STRS[] = {
    NULL,

    "core.assign",
    "core.bool.or_sc",
    "core.bool.and_sc",

    "core.add",
    "core.sub",
    "core.mul",
    "core.div",
    "core.rem",

    "core.shl",
    "core.shr",
    "core.bitand",
    "core.bitor",
    "core.bitxor",

    "core.eq",
    "core.ne",
    "core.lt",
    "core.lte",
    "core.gt",
    "core.gte",
};

static const char* const GL_CAST_CONV_ID_STRS[] = {
    NULL,

    "core.cast.intlit_to_int",
    "core.cast.int_to_int",
    "core.cast.int_to_ptr",
    "core.cast.ptr_to_int",
};

size_t gl_builtin_type_id_count(void) {
    return (size_t)(GL_BUILTIN_TYPE__COUNT - 1);
}

const char* gl_builtin_type_id_to_string(GlBuiltinTypeId v) {
    if ((size_t)v >= (sizeof(GL_BUILTIN_TYPE_ID_STRS) / sizeof(GL_BUILTIN_TYPE_ID_STRS[0]))) return NULL;
    return GL_BUILTIN_TYPE_ID_STRS[v];
}

bool gl_builtin_type_id_from_string(const char* s, GlBuiltinTypeId* out) {
    if (!s || !out) return false;
    for (size_t i = 1; i < (sizeof(GL_BUILTIN_TYPE_ID_STRS) / sizeof(GL_BUILTIN_TYPE_ID_STRS[0])); i++) {
        const char* v = GL_BUILTIN_TYPE_ID_STRS[i];
        if (v && strcmp(v, s) == 0) {
            *out = (GlBuiltinTypeId)i;
            return true;
        }
    }
    *out = GL_BUILTIN_TYPE__INVALID;
    return false;
}

size_t gl_op_id_count(void) {
    return (size_t)(GL_OP__COUNT - 1);
}

const char* gl_op_id_to_string(GlOpId v) {
    if ((size_t)v >= (sizeof(GL_OP_ID_STRS) / sizeof(GL_OP_ID_STRS[0]))) return NULL;
    return GL_OP_ID_STRS[v];
}

bool gl_op_id_from_string(const char* s, GlOpId* out) {
    if (!s || !out) return false;
    for (size_t i = 1; i < (sizeof(GL_OP_ID_STRS) / sizeof(GL_OP_ID_STRS[0])); i++) {
        const char* v = GL_OP_ID_STRS[i];
        if (v && strcmp(v, s) == 0) {
            *out = (GlOpId)i;
            return true;
        }
    }
    *out = GL_OP__INVALID;
    return false;
}

size_t gl_cast_conv_id_count(void) {
    return (size_t)(GL_CAST_CONV__COUNT - 1);
}

const char* gl_cast_conv_id_to_string(GlCastConvId v) {
    if ((size_t)v >= (sizeof(GL_CAST_CONV_ID_STRS) / sizeof(GL_CAST_CONV_ID_STRS[0]))) return NULL;
    return GL_CAST_CONV_ID_STRS[v];
}

bool gl_cast_conv_id_from_string(const char* s, GlCastConvId* out) {
    if (!s || !out) return false;
    for (size_t i = 1; i < (sizeof(GL_CAST_CONV_ID_STRS) / sizeof(GL_CAST_CONV_ID_STRS[0])); i++) {
        const char* v = GL_CAST_CONV_ID_STRS[i];
        if (v && strcmp(v, s) == 0) {
            *out = (GlCastConvId)i;
            return true;
        }
    }
    *out = GL_CAST_CONV__INVALID;
    return false;
}
