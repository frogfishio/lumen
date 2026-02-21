# Lumen Language Support

Syntax highlighting, snippets, and editor configuration for the **Lumen** programming language (files ending in `.lm`).

This extension is intentionally lightweight: it provides a high-quality editing experience without requiring a language server.

## Features

- TextMate-based syntax highlighting for Lumen surface syntax used across `doc/spec/examples` and `tests/*`.
- Comment toggling (`//` and `/* */`), bracket matching, and basic indentation rules.
- Snippets for common constructs (`fn`, `struct`, `enum`, `match`, `extern "C" fn`, `test`, `macro`, …).

## Development

- Open this repo in VS Code
- Go to the `lumen-language-support/` folder
- Press `F5` to launch an Extension Development Host
- Open any `.lm` file (for example under `tests/conformance/`) and verify highlighting/snippets

## Known limitations

- The syntax highlighter is regex-based (TextMate). It does not do type-aware highlighting.
- Nested block comments are best-effort (depends on the editor’s TextMate engine behavior).

## Publishing notes

The manifest contains a placeholder `publisher` value. Update it (and optionally add repository/bugs/homepage fields) before publishing to the marketplace.
