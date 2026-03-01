// Minimalist C shim for Lumen experiments.
//
// This is intentionally tiny and a bit "raw": it provides only a small set of
// primitives that Lumen code can bind to via `extern "C"`.
//
// Conventions:
// - Pointers are passed as `size_t` (Lumen `Usize`).
// - Lengths are `size_t`.
// - Most operations return `int` (Lumen `I32`). For read/write:
//   - >= 0 is a byte count
//   - < 0 is `-errno` (or -EINVAL style for argument errors)

#include <errno.h>
#include <stddef.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <unistd.h>

// Environment
// Returns a pointer to a NUL-terminated value string owned by the host process,
// or 0 if the variable is not set.
size_t lf_getenv(size_t name_ptr) {
	if (!name_ptr) {
		return 0;
	}
	const char* v = getenv((const char*)name_ptr);
	return (size_t)v;
}

static int lf_errno_or(int fallback) {
	return errno ? -errno : fallback;
}

static int lf_write_all(int fd, const void *buf, size_t len) {
	if (len == 0) {
		return 0;
	}
	if (!buf) {
		return -EINVAL;
	}

	const unsigned char *p = (const unsigned char *)buf;
	size_t remaining = len;
	while (remaining > 0) {
		ssize_t n = write(fd, p, remaining);
		if (n < 0) {
			if (errno == EINTR) {
				continue;
			}
			return lf_errno_or(-EIO);
		}
		if (n == 0) {
			break;
		}
		p += (size_t)n;
		remaining -= (size_t)n;
	}
	return (int)(len - remaining);
}

int lf_puts(const unsigned char *s) {
	if (!s) {
		return -EINVAL;
	}
	// libc `puts` writes to stdout and appends a newline.
	return puts((const char *)s);
}

int lf_write_stdout(size_t buf_ptr, size_t len) {
	return lf_write_all(1, (const void *)buf_ptr, len);
}

int lf_write_stderr(size_t buf_ptr, size_t len) {
	return lf_write_all(2, (const void *)buf_ptr, len);
}

int lf_read_stdin(size_t buf_ptr, size_t cap) {
	if (cap == 0) {
		return 0;
	}
	if (!buf_ptr) {
		return -EINVAL;
	}

	for (;;) {
		ssize_t n = read(0, (void *)buf_ptr, cap);
		if (n < 0) {
			if (errno == EINTR) {
				continue;
			}
			return lf_errno_or(-EIO);
		}
		return (int)n;
	}
}

size_t lf_alloc(size_t bytes) {
	if (bytes == 0) {
		bytes = 1;
	}
	void *p = malloc(bytes);
	return (size_t)p;
}

int lf_free(size_t ptr) {
	if (!ptr) {
		return 0;
	}
	free((void *)ptr);
	return 0;
}

size_t lf_memcpy(size_t dst, size_t src, size_t n) {
	return (size_t)memcpy((void *)dst, (const void *)src, n);
}

size_t lf_memmove(size_t dst, size_t src, size_t n) {
	return (size_t)memmove((void *)dst, (const void *)src, n);
}

size_t lf_memset(size_t dst, int byte, size_t n) {
	return (size_t)memset((void *)dst, byte, n);
}