# Grammar Sketch (EBNF)

program     ::= declaration*
declaration ::= fn_decl | struct_decl | enum_decl | import_decl

fn_decl     ::= ("unsafe")? "fn" IDENT "(" params ")" return? block
block       ::= "{" statement* "}"
