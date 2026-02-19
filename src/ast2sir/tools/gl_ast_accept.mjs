#!/usr/bin/env node
/*
GL AST acceptance tester (dependency-free).

Usage:
  node sir/src/ast2sir/tools/gl_ast_accept.mjs <artifact.ast.json> [more.json ...]

Exit codes:
  0: accepted
  2: rejected (validation errors)
  64: usage error
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function usageAndExit(code) {
  const msg = [
    'Usage: node src/ast2sir/tools/gl_ast_accept.mjs [--gl-sig path/to/gl_sig.c] [--seepage] <artifact.ast.json> [more.json ...]',
  ].join('\n');
  // eslint-disable-next-line no-console
  console.error(msg);
  process.exit(code);
}

function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isTok(x) {
  return isPlainObject(x) && x.k === 'tok' && Number.isInteger(x.i) && typeof x.text === 'string';
}

function loadCanonicalVocab(scriptDir) {
  const vocabPath = path.resolve(scriptDir, '../etc/gl_vocab.json');
  try {
    const v = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
    if (!isPlainObject(v)) return null;
    const builtin_type_ids = Array.isArray(v.builtin_type_ids) ? v.builtin_type_ids.filter((x) => typeof x === 'string' && x.length > 0) : null;
    const op_ids = Array.isArray(v.op_ids) ? v.op_ids.filter((x) => typeof x === 'string' && x.length > 0) : null;
    const cast_conv_ids = Array.isArray(v.cast_conv_ids) ? v.cast_conv_ids.filter((x) => typeof x === 'string' && x.length > 0) : null;
    const encoding_ids = Array.isArray(v.encoding_ids) ? v.encoding_ids.filter((x) => typeof x === 'string' && x.length > 0) : null;

    // encoding_ids is optional to keep this tool compatible with older vocab files.
    // When absent, we still load builtin/op/cast inventories and keep the script's
    // default ENCODING_IDS allowlist.
    if (!builtin_type_ids || !op_ids || !cast_conv_ids) return null;
    return {
      builtinTypeIds: new Set(builtin_type_ids),
      opIds: new Set(op_ids),
      castConvIds: new Set(cast_conv_ids),
      encodingIds: encoding_ids ? new Set(encoding_ids) : null,
    };
  } catch {
    return null;
  }
}

// Closed semantics vocabulary (allowlisted strings).
// These inventories are intentionally small and stable; they force upstream producers
// to commit meaning via IDs rather than token spellings.
let BUILTIN_TYPE_IDS = new Set([
  // Scalars
  'i8',
  'i32',
  'i64',
  'u8',
  'u32',
  'u64',
  'f32',
  'f64',
  'bool',
  'void',
  // Pointer/view/data interop
  'ptr',
  'slice',
  'bytes',
  'string.utf8',
  'cstr',
]);

let OP_IDS = new Set([
  'core.assign',
  'core.bool.or_sc',
  'core.bool.and_sc',
  'core.add',
  'core.sub',
  'core.mul',
  'core.div',
  'core.rem',
  'core.shl',
  'core.shr',
  'core.bitand',
  'core.bitor',
  'core.bitxor',
  'core.eq',
  'core.ne',
  'core.lt',
  'core.lte',
  'core.gt',
  'core.gte',
]);

let CAST_CONV_IDS = new Set(['core.cast.intlit_to_int', 'core.cast.int_to_int', 'core.cast.int_to_ptr', 'core.cast.ptr_to_int']);

let ENCODING_IDS = new Set(['core.lit.string.utf8', 'core.lit.string.utf8.raw', 'core.lit.bytes', 'core.lit.cstr.utf8z', 'core.lit.char']);

// Fixtures and consumers currently use a compact, stable string form for instantiated/derived types.
// This validator treats these strings as a closed grammar (no ad-hoc spellings).
const TYPE_CONSTRUCTORS = new Set(['array', 'ptr', 'slice']);

function collectTypeDeclIds(ast) {
  const out = new Set();
  const stack = [ast];

  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined) continue;

    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    if (!isPlainObject(node)) continue;

    if (node.k === 'TypeDecl' && isTok(node.name) && typeof node.name.text === 'string' && node.name.text.length > 0) {
      out.add(node.name.text);
    }

    for (const v of Object.values(node)) stack.push(v);
  }

  return out;
}

function parseTypeId(s) {
  // Grammar:
  //   Type := IdentOrAny ( '(' Args ')' )?
  //   Args := Arg (',' Arg)*
  //   Arg  := Type | Int
  // Ident allows '.' (for e.g. string.utf8).
  if (typeof s !== 'string') return { ok: false, err: 'not a string' };
  let i = 0;
  const n = s.length;

  const isWs = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
  const skipWs = () => {
    while (i < n && isWs(s[i])) i++;
  };
  const peek = () => (i < n ? s[i] : null);
  const consume = (ch) => {
    if (s[i] !== ch) return false;
    i++;
    return true;
  };

  const parseIdent = () => {
    skipWs();
    const start = i;
    if (i >= n) return null;
    // Accept alpha/_ as start.
    if (!/[_A-Za-z]/.test(s[i])) return null;
    i++;
    while (i < n && /[_A-Za-z0-9.]/.test(s[i])) i++;
    const ident = s.slice(start, i);
    if (ident.startsWith('.') || ident.endsWith('.') || ident.includes('..')) return null;
    return ident;
  };

  const parseInt = () => {
    skipWs();
    const start = i;
    while (i < n && /[0-9]/.test(s[i])) i++;
    if (i === start) return null;
    const lit = s.slice(start, i);
    // Safe integer parse (fixtures use small constants).
    const v = Number.parseInt(lit, 10);
    if (!Number.isSafeInteger(v)) return null;
    return v;
  };

  const parseType = () => {
    skipWs();
    if (s.slice(i, i + 3) === 'any' && (i + 3 === n || !/[_A-Za-z0-9.]/.test(s[i + 3]))) {
      i += 3;
      return { head: 'any', args: [] };
    }
    const head = parseIdent();
    if (!head) return null;

    skipWs();
    if (!consume('(')) return { head, args: [] };

    const args = [];
    skipWs();
    if (consume(')')) return { head, args };

    while (true) {
      skipWs();
      const save = i;
      const intArg = parseInt();
      if (intArg !== null) {
        args.push({ kind: 'int', value: intArg });
      } else {
        i = save;
        const ty = parseType();
        if (!ty) return null;
        args.push({ kind: 'type', value: ty });
      }

      skipWs();
      if (consume(')')) break;
      if (!consume(',')) return null;
    }

    return { head, args };
  };

  const ty = parseType();
  skipWs();
  if (!ty || i !== n) return { ok: false, err: 'invalid type_id grammar' };
  return { ok: true, ty };
}

function validateTypeId(errors, file, where, typeId, allowedNominals) {
  const parsed = parseTypeId(typeId);
  if (!parsed.ok) {
    pushErr(errors, file, where, `invalid type_id '${typeId}': ${parsed.err}`);
    return;
  }

  const isSingleLetterTypeVar = (head) => typeof head === 'string' && /^[A-Z]$/.test(head);
  const isNominalHead = (head) => typeof head === 'string' && /^[A-Z][A-Za-z0-9_]*$/.test(head);
  const isAllowedHead = (head) =>
    BUILTIN_TYPE_IDS.has(head) ||
    TYPE_CONSTRUCTORS.has(head) ||
    allowedNominals.has(head) ||
    head === 'Self' ||
    isSingleLetterTypeVar(head) ||
    isNominalHead(head);

  const walk = (t, w) => {
    const head = t.head;
    if (head !== 'any' && !isAllowedHead(head)) {
      pushErr(errors, file, w, `unknown type head '${head}' (closed vocabulary)`);
      return;
    }

    if (t.args.length === 0) return;

    if (head === 'array') {
      if (t.args.length !== 2) {
        pushErr(errors, file, w, `array(...) must have exactly 2 args; got ${t.args.length}`);
        return;
      }
      const [a0, a1] = t.args;
      if (!a0 || a0.kind !== 'type') {
        pushErr(errors, file, w, 'array(T,N) arg0 must be a type');
      } else {
        walk(a0.value, w);
      }
      if (!a1 || a1.kind !== 'int' || a1.value < 0) {
        pushErr(errors, file, w, 'array(T,N) arg1 must be a non-negative int');
      }
      return;
    }

    if (head === 'ptr' || head === 'slice') {
      if (t.args.length !== 1) {
        pushErr(errors, file, w, `${head}(T) must have exactly 1 arg; got ${t.args.length}`);
        return;
      }
      const [a0] = t.args;
      if (!a0 || a0.kind !== 'type') {
        pushErr(errors, file, w, `${head}(T) arg0 must be a type`);
        return;
      }
      walk(a0.value, w);
      return;
    }

    // Generic application: Foo(T,U,...) — all args are types.
    for (const a of t.args) {
      if (!a || a.kind !== 'type') {
        pushErr(errors, file, w, `type application '${head}(...)' requires type args (no integers)`);
        continue;
      }
      walk(a.value, w);
    }
  };

  walk(parsed.ty, where);
}

function typeIdFromWitness(metaTypes, witnessText) {
  if (!metaTypes || typeof witnessText !== 'string') return null;
  const mapped = metaTypes[witnessText];
  if (typeof mapped === 'string') return mapped;
  return witnessText;
}

function loadGlSigAllowlist(glSigPathAbs) {
  // Extract node kind allowlist from the canonical signature file.
  // We keep this intentionally simple: match `static const Spec3VariantSig gl_variants_X[]`.
  const allow = new Set();
  const src = fs.readFileSync(glSigPathAbs, 'utf8');
  const re = /^\s*static\s+const\s+Spec3VariantSig\s+gl_variants_([A-Za-z0-9_]+)\s*\[\]/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    allow.add(m[1]);
  }
  return allow;
}

function pushErr(errors, file, where, msg) {
  errors.push({ file, where, msg });
}

function fmtWhere(where) {
  if (!where || where.length === 0) return '<root>';
  return where.join('');
}

function validateOne(filePath, opts) {
  const abs = path.resolve(filePath);
  const errors = [];
  let obj;

  try {
    obj = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    const baseMsg = String(e && e.message ? e.message : e);
    let hint = '';
    if (abs.endsWith('.jsonl')) {
      hint = ' (note: this looks like JSONL; gl_ast_accept expects a single JSON object .ast.json, not newline-delimited records)';
    }
    pushErr(errors, abs, [], `invalid JSON: ${baseMsg}${hint}`);
    return errors;
  }

  if (!isPlainObject(obj)) {
    pushErr(errors, abs, [], 'top-level must be an object');
    return errors;
  }

  const diagnostics = obj.diagnostics;
  if (!Array.isArray(diagnostics)) {
    pushErr(errors, abs, ['.diagnostics'], 'must be an array');
  } else if (diagnostics.length !== 0) {
    pushErr(errors, abs, ['.diagnostics'], 'must be empty for ship artifacts');
  }

  const ast = obj.ast;
  if (!isPlainObject(ast)) {
    pushErr(errors, abs, ['.ast'], 'must be an object');
    return errors;
  }

  const meta = isPlainObject(obj.meta) ? obj.meta : null;
  const metaTypes = meta && isPlainObject(meta.types) ? meta.types : null;

  // Prefer canonical shared vocab (if present), else fall back to embedded defaults.
  // This keeps downstream lowering + acceptance aligned.
  if (!opts || opts.__vocabLoaded !== true) {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const vocab = loadCanonicalVocab(scriptDir);
    if (vocab) {
      BUILTIN_TYPE_IDS = vocab.builtinTypeIds;
      OP_IDS = vocab.opIds;
      CAST_CONV_IDS = vocab.castConvIds;
      if (vocab.encodingIds) ENCODING_IDS = vocab.encodingIds;
    }
    if (opts) opts.__vocabLoaded = true;
  }

  const declaredTypeIds = collectTypeDeclIds(ast);

  // Closed dictionaries (best-effort): these reduce trust-based string semantics.
  // Capability IDs are intentionally closed.
  // NOTE: we do NOT currently have enough metadata to fully close over TypeRef.type_id
  // (user-defined types, generic params, and instantiated forms appear in fixtures).
  const allowedCaps = new Set(['cap.unsafe']);

  const glAllow = opts && opts.glAllow instanceof Set ? opts.glAllow : null;
  const seepage = Boolean(opts && opts.seepage);

  // Validate meta.tables up front where possible.
  if (metaTypes) {
    for (const [k, v] of Object.entries(metaTypes)) {
      if (typeof v !== 'string' || v.length === 0) {
        pushErr(errors, abs, ['.meta.types', `['${k}']`], 'meta.types values must be non-empty strings');
        continue;
      }
      if (!BUILTIN_TYPE_IDS.has(v)) {
        pushErr(errors, abs, ['.meta.types', `['${k}']`], `meta.types value '${v}' must be an allowlisted builtin type id`);
      }
    }
  }

  if (meta && Array.isArray(meta.op_by_tok_i)) {
    for (let i = 0; i < meta.op_by_tok_i.length; i++) {
      const v = meta.op_by_tok_i[i];
      if (v === null || v === undefined) continue;
      if (typeof v !== 'string' || v.length === 0) {
        pushErr(errors, abs, ['.meta.op_by_tok_i', `[${i}]`], 'must be null/omitted or a non-empty string');
        continue;
      }
      if (!OP_IDS.has(v)) {
        pushErr(errors, abs, ['.meta.op_by_tok_i', `[${i}]`], `unknown operator id '${v}' (closed allowlist)`);
      }
    }
  }

  const symByTokI = Array.isArray(obj.sym_by_tok_i) ? obj.sym_by_tok_i : null;
  const symtab = Array.isArray(obj.symtab) ? obj.symtab : null;
  const declTokISet = new Set();
  if (symtab) {
    for (let idx = 0; idx < symtab.length; idx++) {
      const ent = symtab[idx];
      if (!isPlainObject(ent)) continue;
      if (Number.isInteger(ent.decl_tok_i)) declTokISet.add(ent.decl_tok_i);
    }
  }

  // Collect nids and node kinds for type coverage.
  const nidToKind = new Map();
  let maxNid = -1;

  function recordNidKind(nid, kind) {
    if (!Number.isInteger(nid)) return;
    if (!nidToKind.has(nid)) {
      nidToKind.set(nid, kind);
    }
    if (nid > maxNid) maxNid = nid;
  }

  // Non-typed node kinds (statement/pattern/type wrapper nodes etc.).
  // Everything else is assumed to be an expression/value node and must be typed.
  const untypedKinds = new Set([
    'Unit',
    'Proc',
    'Block',
    'VarPat',
    'PatBind',
    'Name',
    'Args',
    'TypeRef',
    'tok',
  ]);

  const keywordSet = new Set([
    'unsafe',
    'defer',
    'trait',
    'where',
    'pub',
    'crate',
    'super',
    'self',
    'mod',
    'use',
    'extern',
    'repr',
    'align',
    'packed',
    'cfg',
    'mut',
    'static',
    'const',
    'enum',
    'match',
    'for',
    'while',
    'loop',
    'break',
    'continue',
  ]);

  const isPathy = (s) => typeof s === 'string' && (s.includes('::') || s.includes('.') || s.includes('/') || s.includes('\\'));
  const isOpLike = (s) => typeof s === 'string' && ['?', '!', '+', '-', '*', '/', '%', '&', '|', '^', '==', '!=', '<=', '>=', '<', '>', '='].includes(s);

  // Allow Unicode identifiers (e.g. π), but still treat punctuation and paths as seepage.
  // This is a heuristic (not a full lexer), but it should accept common identifier forms.
  const isIdentifierish = (s) => {
    if (typeof s !== 'string') return false;
    // Start: underscore or a Unicode letter.
    // Continue: underscore, Unicode letters, digits, and combining marks.
    return /^[_\p{L}][_\p{L}\p{Nd}\p{Mn}\p{Mc}\p{Pc}]*$/u.test(s);
  };

  function walk(node, where) {
    if (node === null) {
      // We allow null *only* when field is omitted in schema. Explicit null is rejected
      // for identity-bearing fields below.
      return;
    }

    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], where.concat([`[${i}]`]));
      }
      return;
    }

    if (!isPlainObject(node)) return;

    const k = node.k;
    const nid = node.nid;
    if (typeof k === 'string') recordNidKind(nid, k);

    if (glAllow && typeof k === 'string' && k !== 'tok' && !glAllow.has(k)) {
      pushErr(errors, abs, where.concat(['.k']), `unknown node kind '${k}' (not in gl_sig allowlist)`);
    }

    // Enforce identity fields.
    if (k === 'Proc') {
      if (!isTok(node.name)) {
        pushErr(errors, abs, where.concat(['.name']), 'Proc.name must be a tok');
      }

      // Linkage/FFI metadata must be committed structurally, not inferred later.
      if (Object.prototype.hasOwnProperty.call(node, 'extern')) {
        const ex = node.extern;
        const exIsBool = typeof ex === 'boolean';
        const exIsTok = isTok(ex);

        if (!exIsBool && !exIsTok) {
          pushErr(errors, abs, where.concat(['.extern']), 'Proc.extern must be a tok (ABI witness) or boolean true (legacy)');
        } else if (exIsBool && ex !== true) {
          pushErr(errors, abs, where.concat(['.extern']), 'Proc.extern boolean form must be true when present');
        } else if (exIsBool && node.body !== null) {
          pushErr(
            errors,
            abs,
            where.concat(['.extern']),
            'Proc.extern boolean form is only allowed for decl-only imports (body must be null); exports must use a tok ABI witness'
          );
        } else if (exIsTok && typeof ex.text !== 'string') {
          pushErr(errors, abs, where.concat(['.extern.text']), 'Proc.extern tok must have non-empty text');
        } else if (exIsTok && ex.text.length === 0) {
          pushErr(errors, abs, where.concat(['.extern.text']), 'Proc.extern tok must have non-empty text');
        }
      }

      if (Object.prototype.hasOwnProperty.call(node, 'link_name')) {
        if (node.link_name !== undefined && node.link_name !== null && !isTok(node.link_name)) {
          pushErr(errors, abs, where.concat(['.link_name']), 'Proc.link_name must be omitted or a tok; must not be null');
        } else if (isTok(node.link_name) && node.link_name.text.length === 0) {
          pushErr(errors, abs, where.concat(['.link_name.text']), 'Proc.link_name tok must have non-empty text');
        }
      }

      // Canonical rule: declaration-only procs must explicitly commit extern-ness.
      if (node.body === null && !Object.prototype.hasOwnProperty.call(node, 'extern')) {
        pushErr(errors, abs, where.concat(['.body']), 'Proc.body may be null only for extern/imported procs (missing Proc.extern)');
      }
    }

    if (k === 'ExternProc') {
      if (!isTok(node.name)) {
        pushErr(errors, abs, where.concat(['.name']), 'ExternProc.name must be a tok');
      }
      if (!isTok(node.abi)) {
        pushErr(errors, abs, where.concat(['.abi']), 'ExternProc.abi must be a tok (ABI witness, e.g. "C")');
      } else if (node.abi.text.length === 0) {
        pushErr(errors, abs, where.concat(['.abi.text']), 'ExternProc.abi tok must have non-empty text');
      }

      if (Object.prototype.hasOwnProperty.call(node, 'link_name')) {
        if (node.link_name !== undefined && node.link_name !== null && !isTok(node.link_name)) {
          pushErr(errors, abs, where.concat(['.link_name']), 'ExternProc.link_name must be omitted or a tok; must not be null');
        } else if (isTok(node.link_name) && node.link_name.text.length === 0) {
          pushErr(errors, abs, where.concat(['.link_name.text']), 'ExternProc.link_name tok must have non-empty text');
        }
      }
    }

    if (k === 'Name') {
      if (!isTok(node.id)) {
        pushErr(errors, abs, where.concat(['.id']), 'Name.id must be a tok');
      } else if (symByTokI) {
        const i = node.id.i;
        if (i < 0 || i >= symByTokI.length) {
          pushErr(errors, abs, where.concat(['.id.i']), `Name.id.i out of range for sym_by_tok_i (len=${symByTokI.length})`);
        } else {
          const sym = symByTokI[i];
          if (sym === null || sym === undefined) {
            pushErr(errors, abs, where.concat(['.id.i']), 'unresolved Name: sym_by_tok_i entry is null/undefined');
          } else if (declTokISet.size > 0 && !declTokISet.has(sym)) {
            pushErr(errors, abs, where.concat(['.id.i']), `sym_by_tok_i maps to ${sym}, but no symtab entry has decl_tok_i=${sym}`);
          }
        }
      }

      if (seepage && isTok(node.id)) {
        const t = node.id.text;
        if (keywordSet.has(t)) {
          pushErr(errors, abs, where.concat(['.id.text']), `seepage: keyword used as Name ('${t}')`);
        }
        if (isPathy(t)) {
          pushErr(errors, abs, where.concat(['.id.text']), `seepage: path-like name used in Name ('${t}')`);
        }
        if (isOpLike(t)) {
          pushErr(errors, abs, where.concat(['.id.text']), `seepage: operator-like token used as Name ('${t}')`);
        }
      }
    }

    if (k === 'TypeRef') {
      if (typeof node.type_id !== 'string' || node.type_id.length === 0) {
        pushErr(errors, abs, where.concat(['.type_id']), 'TypeRef.type_id must be a non-empty string');
      } else {
        validateTypeId(errors, abs, where.concat(['.type_id']), node.type_id, declaredTypeIds);
      }

      if (Object.prototype.hasOwnProperty.call(node, 'name')) {
        if (node.name === null) {
          pushErr(errors, abs, where.concat(['.name']), 'TypeRef.name must be omitted or a tok; must not be null');
        } else if (node.name !== undefined && !isTok(node.name)) {
          pushErr(errors, abs, where.concat(['.name']), 'TypeRef.name must be a tok when present');
        } else if (isTok(node.name) && metaTypes) {
          const witness = node.name.text;
          const resolved = typeIdFromWitness(metaTypes, witness);
          if (resolved !== node.type_id) {
            pushErr(
              errors,
              abs,
              where.concat(['.name.text']),
              `TypeRef witness text '${witness}' does not resolve (via meta.types) to type_id '${node.type_id}' (got '${resolved}')`
            );
          }
        }
      }
    }

    if (k === 'CapBlock') {
      // Historical fixtures sometimes store cap as tok; newer canonical form may store a committed string.
      let capId = null;
      if (typeof node.cap === 'string') capId = node.cap;
      else if (isTok(node.cap)) capId = node.cap.text;

      if (typeof capId !== 'string' || capId.length === 0) {
        pushErr(errors, abs, where.concat(['.cap']), 'CapBlock.cap must be a non-empty string (or tok with non-empty text)');
      } else if (!allowedCaps.has(capId)) {
        pushErr(errors, abs, where.concat(['.cap']), `unknown capability id '${capId}' (closed allowlist)`);
      }
    }

    if (k === 'Cast') {
      if (!Object.prototype.hasOwnProperty.call(node, 'conv_id')) {
        pushErr(errors, abs, where.concat(['.conv_id']), 'Cast.conv_id must be present for ship artifacts (committed conversion id)');
      } else {
        let convId = null;
        if (typeof node.conv_id === 'string') convId = node.conv_id;
        else if (isTok(node.conv_id)) convId = node.conv_id.text;

        if (typeof convId !== 'string' || convId.length === 0) {
          pushErr(errors, abs, where.concat(['.conv_id']), 'Cast.conv_id must be a non-empty string (or tok with non-empty text)');
        } else if (!CAST_CONV_IDS.has(convId)) {
          pushErr(errors, abs, where.concat(['.conv_id']), `unknown cast conversion id '${convId}' (closed allowlist)`);
        }
      }
    }

    // Literal payload encoding must be committed (don’t infer escape semantics from token text).
    if (k === 'StringUtf8' || k === 'Bytes' || k === 'CStr' || k === 'Char') {
      if (!Object.prototype.hasOwnProperty.call(node, 'encoding')) {
        pushErr(errors, abs, where.concat(['.encoding']), `${k}.encoding must be present for ship artifacts (committed literal encoding id)`);
      } else {
        let encId = null;
        if (typeof node.encoding === 'string') encId = node.encoding;
        else if (isTok(node.encoding)) encId = node.encoding.text;

        if (typeof encId !== 'string' || encId.length === 0) {
          pushErr(errors, abs, where.concat(['.encoding']), `${k}.encoding must be a non-empty string (or tok with non-empty text)`);
        } else if (!ENCODING_IDS.has(encId)) {
          pushErr(errors, abs, where.concat(['.encoding']), `unknown literal encoding id '${encId}' (closed allowlist)`);
        }
      }
    }

    if (seepage && symtab && typeof k === 'string') {
      // Symtab seepage checks are done once per file below.
      // Here we optionally flag obviously semantic keywords being used as structural names.
      if (k === 'Unit' && isTok(node.name)) {
        const t = node.name.text;
        if (keywordSet.has(t)) {
          pushErr(errors, abs, where.concat(['.name.text']), `seepage: keyword used as Unit.name ('${t}')`);
        }
      }
    }

    // Operators must be committed (don’t guess punctuation).
    if (k === 'Bin' || k === 'Assign' || k === 'Unary') {
      const opFieldPresent = Object.prototype.hasOwnProperty.call(node, 'op');
      const opIsTok = opFieldPresent && isTok(node.op);
      const opIsString = opFieldPresent && typeof node.op === 'string' && node.op.length > 0;
      const opIdIsString = typeof node.op_id === 'string' && node.op_id.length > 0;
      const hasMetaOpTable = meta && Array.isArray(meta.op_by_tok_i);

      let committed = null;
      if (opIdIsString) committed = node.op_id;
      else if (opIsString) committed = node.op;
      else if (opIsTok && hasMetaOpTable) {
        const i = node.op.i;
        const v = i >= 0 && i < meta.op_by_tok_i.length ? meta.op_by_tok_i[i] : null;
        if (typeof v === 'string' && v.length > 0) committed = v;
        else {
          pushErr(errors, abs, where.concat(['.op.i']), 'operator must be committed via meta.op_by_tok_i');
        }
      } else if (opIsTok && !hasMetaOpTable) {
        pushErr(errors, abs, where.concat(['.op']), 'operator must be committed: provide op_id, or op as a string id, or meta.op_by_tok_i');
      } else if (!opIsTok && !opIsString && !opIdIsString) {
        pushErr(errors, abs, where.concat(['.op']), 'operator must be committed: expected op_id, op string id, or op tok + meta.op_by_tok_i');
      }

      if (typeof committed === 'string' && committed.length > 0 && !OP_IDS.has(committed)) {
        pushErr(errors, abs, where.concat(['.op']), `unknown operator id '${committed}' (closed allowlist)`);
      }
    }

    // Recurse.
    for (const [key, value] of Object.entries(node)) {
      if (key === 'k' || key === 'nid') continue;
      walk(value, where.concat([`.${key}`]));
    }
  }

  walk(ast, ['.ast']);

  if (seepage && symtab) {
    for (let idx = 0; idx < symtab.length; idx++) {
      const ent = symtab[idx];
      if (!isPlainObject(ent)) continue;
      const name = ent.name;
      if (typeof name !== 'string') continue;
      if (keywordSet.has(name)) {
        pushErr(errors, abs, [`.symtab[${idx}].name`], `seepage: keyword appears in symtab ('${name}')`);
      }
      if (isPathy(name)) {
        pushErr(errors, abs, [`.symtab[${idx}].name`], `seepage: path-like name appears in symtab ('${name}')`);
      }
      if (isOpLike(name)) {
        pushErr(errors, abs, [`.symtab[${idx}].name`], `seepage: operator-like name appears in symtab ('${name}')`);
      }
      // This is intentionally a soft heuristic, but still useful.
      if (!isIdentifierish(name) && !name.startsWith('_')) {
        pushErr(errors, abs, [`.symtab[${idx}].name`], `seepage: non-identifierish symtab name ('${name}')`);
      }
    }
  }

  // Types must be known (this tester enforces type_by_nid coverage).
  const tbn = obj.type_by_nid;
  if (!Array.isArray(tbn)) {
    pushErr(errors, abs, ['.type_by_nid'], 'must be an array (required by this acceptance tester)');
  } else {
    if (maxNid >= 0 && tbn.length !== maxNid + 1) {
      pushErr(errors, abs, ['.type_by_nid'], `length must be max_nid+1 (${maxNid + 1}), got ${tbn.length}`);
    }

    for (const [nid, kind] of nidToKind.entries()) {
      if (untypedKinds.has(kind)) continue;
      const ty = nid >= 0 && nid < tbn.length ? tbn[nid] : null;
      if (ty === null || ty === undefined) {
        pushErr(errors, abs, [`.type_by_nid[${nid}]`], `missing type for node kind '${kind}' (nid=${nid})`);
      }
    }

    // Validate that all present type IDs are in the closed type vocabulary/grammar.
    for (let nid = 0; nid < tbn.length; nid++) {
      const ty = tbn[nid];
      if (ty === null || ty === undefined) continue;
      if (typeof ty !== 'string' || ty.length === 0) {
        pushErr(errors, abs, [`.type_by_nid[${nid}]`], 'type_id entries must be non-empty strings or null');
        continue;
      }
      validateTypeId(errors, abs, [`.type_by_nid[${nid}]`], ty, declaredTypeIds);
    }
  }

  // Name resolution must be present.
  if (!symByTokI) {
    // If they later add symbol_id directly on Name nodes, we can accept that.
    // For now, enforce the side-table route.
    pushErr(errors, abs, ['.sym_by_tok_i'], 'must be present (array) to resolve Name nodes (or add Name.symbol_id and update tester)');
  }

  return errors;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usageAndExit(args.length === 0 ? 64 : 0);
  }

  const files = [];
  let seepage = false;
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  let glSigPath = path.resolve(scriptDir, '../etc/gl_sig.c');

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--seepage') {
      seepage = true;
      continue;
    }
    if (a === '--gl-sig') {
      const v = args[i + 1];
      if (!v) usageAndExit(64);
      glSigPath = path.resolve(v);
      i++;
      continue;
    }
    files.push(a);
  }

  if (files.length === 0) usageAndExit(64);

  let glAllow = null;
  try {
    glAllow = loadGlSigAllowlist(glSigPath);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(`REJECT could not read gl_sig allowlist at ${glSigPath}: ${String(e && e.message ? e.message : e)}`);
    process.exit(2);
  }

  let allErrors = [];
  for (const p of files) {
    const errs = validateOne(p, { glAllow, seepage });
    allErrors = allErrors.concat(errs);
  }

  if (allErrors.length === 0) {
    // eslint-disable-next-line no-console
    console.log('ACCEPT');
    process.exit(0);
  }

  for (const e of allErrors) {
    // eslint-disable-next-line no-console
    console.error(`REJECT ${e.file} ${fmtWhere(e.where)}: ${e.msg}`);
  }
  // eslint-disable-next-line no-console
  console.error(`REJECT (${allErrors.length} errors)`);
  process.exit(2);
}

main(process.argv);
