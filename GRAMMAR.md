# Grammar Sketch (EBNF)

program     ::= declaration*
declaration ::= fn_decl | struct_decl | enum_decl | import_decl

fn_decl     ::= "fn" IDENT "(" params ")" effects? return block
effects     ::= ("async" | "throws" | "io")+
block       ::= "{" statement* "}"
