# Lumen Complete Formal Grammar (EBNF) — v1.0-draft

This grammar is intended to be **complete** for the Lumen surface syntax described in `SPEC.md` (v1.0-draft).
It is written in EBNF with the following conventions:

- Terminals are in double quotes, e.g. `"fn"`.
- Nonterminals are in angle brackets, e.g. `<expr>`.
- `{ X }` means repetition (0+).
- `[ X ]` means optional (0/1).
- `( A | B )` means alternation.
- `/* ... */` are grammar comments.
- Lexical rules are included for completeness, but real implementations should use a lexer.

> Notes:
> - The grammar is **brace-form** (canonical formatted output). Optional indentation/layout mode is a front-end transform that produces the same brace tokens.
> - Some constructs are marked *(feature-gated)*, meaning they exist but require an explicit language feature flag.
> - Operator precedence is encoded by layered nonterminals (`<expr_or>`, `<expr_and>`, etc.).

---

## 1. Lexical Grammar

### 1.1 Character classes (informal)
```
letter        = Unicode XID_Start
letter_or_num = Unicode XID_Continue
digit         = "0".."9"
hexdigit      = digit | "a".."f" | "A".."F"
bindigit      = "0" | "1"
ws            = " " | "\t" | "\r" | "\n"
```

### 1.2 Tokens
```
<ident>        = <ident_start> { <ident_continue> } ;
<ident_start>  = letter | "_" ;
<ident_continue> = letter_or_num | "_" ;

<int_lit>      = <dec_int> | <hex_int> | <bin_int> ;
<dec_int>      = digit { digit | "_" } ;
<hex_int>      = "0x" hexdigit { hexdigit | "_" } ;
<bin_int>      = "0b" bindigit { bindigit | "_" } ;

<float_lit>    = <dec_float> ;
<dec_float>    = ( digit { digit | "_" } "." { digit | "_" } [ <exp> ] )
               | ( digit { digit | "_" } <exp> ) ;
<exp>          = ("e" | "E") [ "+" | "-" ] digit { digit | "_" } ;

<char_lit>     = "'" <char_body> "'" ;
<string_lit>   = '"' { <string_char> } '"' ;
<ml_string_lit> = ' { <ml_string_char> } ' ;

<bytes_lit>    = 'b"' { <byte_char> } '"' ;

<comment_line> = "//" { /* any char except newline */ } ;
<comment_block> = "/*" { <comment_block> | /* any char */ } "*/" ;

<ws_or_comment> = ws | <comment_line> | <comment_block> ;
```

### 1.3 Reserved keywords
Terminals listed in the spec: `fn let mut if else match for while loop break continue return struct enum trait impl use as pub try defer true false self super extern static unsafe in`
Plus contextual keywords used here: `where type macro test const asm`.

---

## 2. Top-level Structure

```
<program>         = { <item> } <eof> ;

<item>            = <use_item>
                  | <extern_item>
                  | <fn_item>
                  | <static_item>
                  | <struct_item>
                  | <union_item>
                  | <enum_item>
                  | <trait_item>
                  | <impl_item>
                  | <type_item>           /* feature-gated */
                  | <const_item>          /* feature-gated */
                  | <macro_item>          /* feature-gated */
                  | <test_item> ;

<visibility>      = "pub" [ "(" ( "crate" | "super" ) ")" ] ;

<attrs>           = { <attr> } ;
<attr>            = "@" <ident> [ "(" [ <attr_args> ] ")" ] ;
<attr_args>       = <attr_arg> { "," <attr_arg> } [ "," ] ;
<attr_arg>        = <ident> "=" <literal> | <expr> ;
```

### 2.1 Imports

```
<use_item>        = <attrs> [ <visibility> ] "use" <use_tree> ";" ;

<use_tree>        = <use_path> [ "as" <ident> ]
                  | <use_path> "::" "{" <use_tree_list> "}" ;

<use_tree_list>   = <use_tree> { "," <use_tree> } [ "," ] ;

<use_path>        = <use_path_root> { "::" <ident> } ;
<use_path_root>   = <ident> | "self" | "super" ;
```

### 2.2 Extern declarations

```
<extern_item>     = <attrs> [ <visibility> ] "extern" <abi>
                    ( <extern_fn_decl> | <extern_static_decl> ) ;

<abi>             = <string_lit> ; /* e.g. "C" */

<extern_fn_decl>  = [ "unsafe" ] "fn" <ident>
                    "(" [ <extern_param_list> ] ")"
                    [ "->" <type> ]
                    ";" ;

<extern_param_list> = "..."
                   | <param_list> [ "," "..." ] ;

<extern_static_decl> = "static" [ "mut" ] <ident> ":" <type> ";" ;
```

### 2.2.1 Static items

```
<static_item>     = <attrs> [ <visibility> ] "static" [ "mut" ] <ident> ":" <type>
                    [ "=" <expr> ] ";" ;
/* Note: The initializer expression is restricted by `SPEC.md` (static initializer expressions). */
```

### 2.2 Functions

```
<fn_item>         = <attrs> [ <visibility> ] [ "unsafe" ] "fn" <ident>
                    [ <generic_params> ]
                    "(" [ <param_list> ] ")"
                    [ "->" <type> ]
                    <block> ;

<generic_params>  = "[" <generic_param> { "," <generic_param> } [ "," ] "]" ;
<generic_param>   = <ident> [ ":" <type_bounds> ] ;

<type_bounds>     = <type_bound> { "+" <type_bound> } ;
<type_bound>      = <path> ;

<param_list>      = <param> { "," <param> } [ "," ] ;
<param>           = [ <attrs> ] <pat> ":" <type> ;

<block>           = "{" { <stmt> } [ <expr> ] "}" ;
```

### 2.3 Structs and Enums

```
<struct_item>     = <attrs> [ <visibility> ] "struct" <ident>
                    [ <generic_params> ]
                    ( <struct_fields> ";" | <struct_fields> | ";" ) ;

<struct_fields>   = "{" [ <field_list> ] "}" ;
<field_list>      = <field> { "," <field> } [ "," ] ;
<field>           = <attrs> [ <visibility> ] <ident> ":" <type> ;

<union_item>      = <attrs> [ <visibility> ] "union" <ident>
                    ( <struct_fields> ";" | <struct_fields> | ";" ) ;

<enum_item>       = <attrs> [ <visibility> ] "enum" <ident>
                    [ <generic_params> ]
                    "{" [ <variant_list> ] "}" ;

<variant_list>    = <variant> { "," <variant> } [ "," ] ;
<variant>         = <attrs> [ <visibility> ] <ident>
                    ( "(" [ <type_list> ] ")" | <struct_fields> | /* unit */ ) ;

<type_list>       = <type> { "," <type> } [ "," ] ;
```

### 2.4 Traits and impls

```
<trait_item>      = <attrs> [ <visibility> ] "trait" <ident>
                    [ <generic_params> ]
                    [ <where_clause> ]
                    "{" { <trait_member> } "}" ;

<trait_member>    = <fn_sig> ";"
                  | <type_assoc> ";"       /* feature-gated */
                  | <const_assoc> ";"      /* feature-gated */ ;

<fn_sig>          = <attrs> "fn" <ident>
                    [ <generic_params> ]
                    "(" [ <param_list> ] ")"
                    [ "->" <type> ]
                    [ <where_clause> ] ;

<impl_item>       = <attrs> [ "unsafe" ] "impl"
                    [ <generic_params> ]
                    <impl_target>
                    [ <where_clause> ]
                    "{" { <impl_member> } "}" ;

<impl_target>     = ( <path> "for" <type> )  /* trait impl */
                  | <type> ;                 /* inherent impl */

<impl_member>     = <fn_item_in_impl>
                  | <type_item_in_impl>      /* feature-gated */
                  | <const_item_in_impl> ;   /* feature-gated */

<fn_item_in_impl> = <attrs> [ <visibility> ] [ "unsafe" ] "fn" <ident>
                    [ <generic_params> ]
                    "(" [ <param_list> ] ")"
                    [ "->" <type> ]
                    [ <where_clause> ]
                    <block> ;

<where_clause>    = "where" <where_pred> { "," <where_pred> } [ "," ] ;
<where_pred>      = <type> ":" <type_bounds> ;
```

### 2.5 Type aliases / consts / macros / tests (feature-gated items shown)

```
<type_item>       = <attrs> [ <visibility> ] "type" <ident>
                    [ <generic_params> ]
                    "=" <type> ";" ;

<const_item>      = <attrs> [ <visibility> ] "const" <ident> ":" <type>
                    "=" <expr> ";" ;

<macro_item>      = <attrs> [ <visibility> ] "macro" <ident>
                    <macro_rules_block> ;

<macro_rules_block> = "{" { /* token-tree rules */ } "}" ;

<test_item>       = <attrs> [ <visibility> ] "test" <string_lit> <block> ;
```

---

## 3. Statements and Blocks

```
<stmt>            = <let_stmt>
                  | <item_stmt>
                  | <expr_stmt>
                  | <semi_stmt> ;

<semi_stmt>       = ";" ;

<item_stmt>       = <item> ; /* items allowed in block scope */

<let_stmt>        = <attrs> "let" [ "mut" ] <pat> [ ":" <type> ] "=" <expr> ";" ;

<expr_stmt>       = <expr> ";" ;
```

### 3.1 Patterns

```
<pat>             = <pat_or> ;

<pat_or>          = <pat_primary> { "|" <pat_primary> } ;

<pat_primary>     = "_"
                  | <ident_pat>
                  | <literal_pat>
                  | <tuple_pat>
                  | <struct_pat>
                  | <enum_pat>
                  | <paren_pat> ;

<ident_pat>       = <ident> [ ":" <pat> ] ;

<literal_pat>     = <literal> ;

<tuple_pat>       = "(" [ <pat_list> ] ")" ;
<pat_list>        = <pat> { "," <pat> } [ "," ] ;

<struct_pat>      = <path> "{" [ <field_pat_list> ] "}" ;
<field_pat_list>  = <field_pat> { "," <field_pat> } [ "," ] ;
<field_pat>       = <ident> [ ":" <pat> ] | ".." ;

<enum_pat>        = <path>
                    ( "(" [ <pat_list> ] ")"
                    | "{" [ <field_pat_list> ] "}" ) ;

<paren_pat>       = "(" <pat> ")" ;

<literal>         = <int_lit> | <float_lit> | <string_lit> | <ml_string_lit>
                  | <char_lit> | <bytes_lit> | "true" | "false" ;
```

---

## 4. Expressions

Expressions are organized by precedence (lowest at top).

```
<expr>            = <expr_or> ;

<expr_or>         = <expr_and> { "||" <expr_and> } ;
<expr_and>        = <expr_cmp> { "&&" <expr_cmp> } ;

<expr_cmp>        = <expr_bit_or> [ <cmp_op> <expr_bit_or> ] ;
<cmp_op>          = "==" | "!=" | "<" | "<=" | ">" | ">=" ;

<expr_bit_or>     = <expr_bit_xor> { "|" <expr_bit_xor> } ;
<expr_bit_xor>    = <expr_bit_and> { "^" <expr_bit_and> } ;
<expr_bit_and>    = <expr_shift> { "&" <expr_shift> } ;

<expr_shift>      = <expr_add> { ( "<<" | ">>" ) <expr_add> } ;

<expr_add>        = <expr_mul> { ( "+" | "-" ) <expr_mul> } ;
<expr_mul>        = <expr_unary> { ( "*" | "/" | "%" ) <expr_unary> } ;

<expr_unary>      = { <unary_op> } <expr_postfix> ;
<unary_op>        = "!" | "-" | "~" | "&" | "*" | "try" ;

<expr_postfix>    = <expr_primary> { <postfix> } ;

<postfix>         = <call>
                  | <index>
                  | <field_access>
                  | <method_call>
                  | <cast_postfix>
                  | <type_args_postfix>    /* feature-gated (turbofish) */
                  ;

<cast_postfix>    = "as" <type> ;

<type_args_postfix> = "::" <type_args> ;

<call>            = "(" [ <arg_list> ] ")" ;
<arg_list>        = <arg> { "," <arg> } [ "," ] ;
<arg>             = <expr> | <named_arg> ;
<named_arg>       = <ident> ":" <expr> ;

<index>           = "[" <expr> "]" [ "?" | "!" ] ;

<field_access>    = "." <ident> ;
<method_call>     = "." <ident> [ <type_args_postfix> ] "(" [ <arg_list> ] ")" ;
```

### 4.1 Primary expressions

```
<expr_primary>    = <literal>
                  | <path_expr>
                  | <tuple_expr>
                  | <array_expr>
                  | <struct_expr>
                  | <block_expr>
                  | <if_expr>
                  | <match_expr>
                  | <while_expr>
                  | <for_expr>
                  | <loop_expr>
                  | <break_expr>
                  | <continue_expr>
                  | <return_expr>
                  | <defer_expr>
                  | <asm_expr>
                  | <unsafe_block_expr>
                  | <paren_expr> ;

<path_expr>       = <path> ;

<paren_expr>      = "(" <expr> ")" ;

<tuple_expr>      = "(" <expr> "," [ <expr_list_tail> ] ")"   /* tuple needs comma */
                  | "(" ")" ;
<expr_list_tail>  = <expr> { "," <expr> } [ "," ] ;

<array_expr>      = "[" [ <array_elems> ] "]" ;
<array_elems>     = <expr> { "," <expr> } [ "," ]
                  | <expr> ";" <expr> ;                       /* repeat form */

<struct_expr>     = <path> "{" [ <field_init_list> ] "}" ;
<field_init_list> = <field_init> { "," <field_init> } [ "," ] ;
<field_init>      = <ident> ":" <expr>
                  | <ident>                                   /* shorthand */
                  | ".." <expr> ;

<block_expr>      = <block> ;

<unsafe_block_expr> = "unsafe" <block> ;
```

### 4.2 Control-flow expressions

```
<if_expr>         = "if" <expr> <block> [ "else" ( <block> | <if_expr> ) ] ;

<match_expr>      = "match" <expr> "{" { <match_arm> } "}" ;
<match_arm>       = <pat> [ <match_guard> ] "=>" ( <expr> | <block_expr> ) "," ;
<match_guard>     = "if" <expr> ;

<while_expr>      = "while" <expr> <block> ;

<for_expr>        = "for" <pat> "in" <expr> <block> ;

<loop_expr>       = "loop" <block> ;

<break_expr>      = "break" [ <expr> ] ;

<continue_expr>   = "continue" ;

<return_expr>     = "return" [ <expr> ] ;

<defer_expr>      = "defer" <block> ;

<asm_expr>        = "asm" "(" <string_lit> [ "," <asm_part_list> ] ")" ;
<asm_part_list>   = <asm_part> { "," <asm_part> } [ "," ] ;
<asm_part>        = <asm_in>
                  | <asm_out>
                  | <asm_clobber>
                  | <asm_options> ;

<asm_in>          = "in" "(" <string_lit> ")" <expr> ;
<asm_out>         = "out" "(" <string_lit> ")" <expr> ;
<asm_clobber>     = "clobber" "(" <string_lit> ")" ;
<asm_options>     = "options" "(" <string_lit> { "," <string_lit> } [ "," ] ")" ;
```

## 5. Types

Types also use precedence to avoid ambiguity.

```
<type>            = <type_fn_or> ;

<type_fn_or>      = <type_primary>
                  | "fn" [ <generic_params> ] "(" [ <type_list> ] ")"
                    [ "->" <type> ] ;

<type_primary>    = <type_ref>
                  | <type_path>
                  | <type_tuple>
                  | <type_array>
                  | <type_paren> ;

<type_ref>        = "Ptr" "[" <type> "]"
                  | "Slice" "[" <type> "]" ;

<type_path>       = <path> [ <type_args> ] ;

<type_args>       = "[" <type> { "," <type> } [ "," ] "]" ;

<type_tuple>      = "(" <type> "," [ <type_list_tail> ] ")"
                  | "(" ")" ;

<type_list_tail>  = <type> { "," <type> } [ "," ] ;

<type_array>      = "[" <type> ";" <expr> "]" ;

<type_paren>      = "(" <type> ")" ;
```

---

## 6. Paths

```
<path>            = <path_root> { "::" <path_segment> } ;

<path_root>       = <ident> | "self" | "super" ;

<path_segment>    = <ident> [ <type_args> ] ;
```

---

## 7. Notes on Disambiguation (Parser Guidance)

1. **Tuple vs paren**:
   - `(x)` is a parenthesized expression.
   - `(x,)` is a tuple expression.
   - Same rule for types.

2. **Struct literals vs blocks**:
   - `<path> "{" ... "}"` is a struct literal when `<path>` parses as a path expression.
   - `{ ... }` is a block.

3. **Method call vs field access**:
   - `expr.ident(args)` is parsed as method call.
   - `expr.ident` is field access.

4. **`try` unary operator**:
   - `try expr` binds like other unary operators (tighter than `*`/`+` etc.).

---

## 8. End of Grammar
