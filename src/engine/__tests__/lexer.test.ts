import { describe, expect, it } from 'vitest';
import { lexCpp } from '../languages/cpp';
import type { Token } from '../types';

const sig = (src: string) => lexCpp(src).filter((t) => t.type !== 'whitespace');
const texts = (src: string) => sig(src).map((t) => t.text);
const kinds = (src: string) => sig(src).map((t) => `${t.type}:${t.text}`);

describe('lexer C++: reconstrucción', () => {
  const samples = [
    '#include <bits/stdc++.h>\nusing namespace std;\nint main(){ return 0; }\n',
    'auto s = R"x(a)"b")x"; // fin',
    "char c = '\\''; const char* p = \"\\\"\\\\\";",
    '#define REP(i,n) for(int i=0;i<(n);++i) \\\n  /* cuerpo */\n',
    'a<::b; x<:0:>; y >>= 2;',
  ];
  it.each(samples)('la concatenación de tokens reproduce el texto: %j', (src) => {
    const toks = lexCpp(src);
    expect(toks.map((t) => t.text).join('')).toBe(src);
    let pos = 0;
    for (const t of toks) {
      expect(t.start).toBe(pos);
      expect(src.slice(t.start, t.end)).toBe(t.text);
      pos = t.end;
    }
  });
});

describe('lexer C++: identificadores y palabras clave', () => {
  it('distingue palabras clave de identificadores', () => {
    expect(kinds('int intx int_ _int return returnx')).toEqual([
      'keyword:int', 'identifier:intx', 'identifier:int_', 'identifier:_int', 'keyword:return', 'identifier:returnx',
    ]);
  });
  it('acepta $ y letras Unicode en identificadores', () => {
    expect(texts('a$b niño x1')).toEqual(['a$b', 'niño', 'x1']);
  });
  it('reconoce palabras clave modernas', () => {
    expect(kinds('constexpr nullptr co_await')).toEqual(['keyword:constexpr', 'keyword:nullptr', 'keyword:co_await']);
  });
});

describe('lexer C++: literales numéricos (pp-number)', () => {
  it.each([
    ['42', ['42']],
    ['3.14', ['3.14']],
    ['.5', ['.5']],
    ['1.f', ['1.f']],
    ['1e9', ['1e9']],
    ['1e+5', ['1e+5']],
    ['2.5E-3', ['2.5E-3']],
    ['0x1fULL', ['0x1fULL']],
    ['0x1p-3', ['0x1p-3']],
    ['0b1010', ['0b1010']],
    ["1'000'000", ["1'000'000"]],
    ['1000000007LL', ['1000000007LL']],
    ['1e+5+1', ['1e+5', '+', '1']],
    // pp-number: `0xe+1` es un único token (y un error de compilación en C++).
    ['0xe+1', ['0xe+1']],
    ['1..2', ['1..2']],
    ['12_km', ['12_km']],
  ])('%s', (src, expected) => {
    expect(texts(src)).toEqual(expected);
    expect(sig(src)[0].type).toBe('number');
  });
});

describe('lexer C++: cadenas y caracteres', () => {
  it('maneja escapes', () => {
    expect(kinds('"a\\"b" \'\\\'\' \'\\\\\' "\\\\"')).toEqual(['string:"a\\"b"', "char:'\\''", "char:'\\\\'", 'string:"\\\\"']);
  });
  it('conserva los espacios dentro de cadenas', () => {
    expect(texts('"  a  b  "')).toEqual(['"  a  b  "']);
  });
  it('reconoce prefijos de codificación', () => {
    expect(kinds('u8"a" u"b" U"c" L"d" L\'e\' u8\'f\'')).toEqual([
      'string:u8"a"', 'string:u"b"', 'string:U"c"', 'string:L"d"', "char:L'e'", "char:u8'f'",
    ]);
  });
  it('un prefijo separado por espacio es un identificador', () => {
    expect(kinds('u8 "a"')).toEqual(['identifier:u8', 'string:"a"']);
  });
  it('reconoce raw strings con delimitador, comillas y saltos de línea', () => {
    expect(texts('R"(a\\n"b)" R"xy(1)"2)xy" LR"(z)"')).toEqual(['R"(a\\n"b)"', 'R"xy(1)"2)xy"', 'LR"(z)"']);
    expect(texts('R"(línea 1\nlínea 2)";')).toEqual(['R"(línea 1\nlínea 2)"', ';']);
  });
  it('incluye sufijos de literales definidos por el usuario', () => {
    expect(texts('"abc"s "x"sv \'a\'_c')).toEqual(['"abc"s', '"x"sv', "'a'_c"]);
  });
  it('comentarios dentro de cadenas no son comentarios', () => {
    expect(kinds('"// no" "/* no */"')).toEqual(['string:"// no"', 'string:"/* no */"']);
  });
  it('cadena sin cerrar termina al final de la línea', () => {
    expect(texts('"abc\nint x;')).toEqual(['"abc', 'int', 'x', ';']);
  });
});

describe('lexer C++: comentarios', () => {
  it('comentario de línea', () => {
    const t = sig('int a; // comentario\nint b;');
    expect(t.map((x) => x.text)).toEqual(['int', 'a', ';', '// comentario', 'int', 'b', ';']);
    expect(t[3].commentKind).toBe('line');
  });
  it('comentario de bloque multilínea', () => {
    expect(texts('a /* x\n y */ b')).toEqual(['a', '/* x\n y */', 'b']);
  });
  it('comentario de bloque no anidado', () => {
    expect(texts('/* a /* b */ c */')).toEqual(['/* a /* b */', 'c', '*', '/']);
  });
  it('comentario de línea con continuación', () => {
    expect(texts('// a \\\n b\nc')).toEqual(['// a \\\n b', 'c']);
  });
  it('`/` seguido de `*` en una expresión abre un comentario', () => {
    expect(texts('x/*p')).toEqual(['x', '/*p']);
    expect(texts('x / *p')).toEqual(['x', '/', '*', 'p']);
  });
});

describe('lexer C++: operadores (maximal munch)', () => {
  it.each([
    ['a+++b', ['a', '++', '+', 'b']],
    ['a---b', ['a', '--', '-', 'b']],
    ['a+ ++b', ['a', '+', '++', 'b']],
    ['x>>=1', ['x', '>>=', '1']],
    ['x<<=1', ['x', '<<=', '1']],
    ['a<=>b', ['a', '<=>', 'b']],
    ['p->*m', ['p', '->*', 'm']],
    ['p->m', ['p', '->', 'm']],
    ['o.*m', ['o', '.*', 'm']],
    ['f(a...)', ['f', '(', 'a', '...', ')']],
    ['std::cin', ['std', '::', 'cin']],
    ['a&&b||!c', ['a', '&&', 'b', '||', '!', 'c']],
    ['a&=b|=c^=d', ['a', '&=', 'b', '|=', 'c', '^=', 'd']],
    ['vector<vector<int>>', ['vector', '<', 'vector', '<', 'int', '>>']],
    ['a?b:c', ['a', '?', 'b', ':', 'c']],
    ['a.b', ['a', '.', 'b']],
    ['a<::b', ['a', '<', '::', 'b']],
    ['a<:0:>', ['a', '<:', '0', ':>']],
    ['a<::>', ['a', '<:', ':>']],
  ])('%s', (src, expected) => {
    expect(texts(src)).toEqual(expected);
  });
  it('clasifica puntuación y operadores', () => {
    expect(kinds('f(a,b);{}[]')).toEqual([
      'identifier:f', 'punctuation:(', 'identifier:a', 'punctuation:,', 'identifier:b', 'punctuation:)', 'punctuation:;',
      'punctuation:{', 'punctuation:}', 'punctuation:[', 'punctuation:]',
    ]);
  });
});

describe('lexer C++: preprocesador', () => {
  const dir = (src: string) => sig(src).map((t: Token) => `${t.text}@${t.directive}`);
  it('agrupa los tokens de cada directiva', () => {
    expect(dir('#include <vector>\n#define N 5\nint a;')).toEqual([
      '#@0', 'include@0', '<vector>@0', '#@1', 'define@1', 'N@1', '5@1', 'int@-1', 'a@-1', ';@-1',
    ]);
  });
  it('reconoce nombres de cabecera solo tras #include', () => {
    expect(kinds('#include<bits/stdc++.h>')).toEqual(['preprocessor:#', 'preprocessor:include', 'header:<bits/stdc++.h>']);
    expect(kinds('#include "lib.h"')).toEqual(['preprocessor:#', 'preprocessor:include', 'header:"lib.h"']);
    expect(kinds('a<b>c')).toEqual(['identifier:a', 'operator:<', 'identifier:b', 'operator:>', 'identifier:c']);
  });
  it('permite espacios entre # y el nombre, e indentación antes de #', () => {
    expect(kinds('  #  define X 1')).toEqual(['preprocessor:#', 'preprocessor:define', 'identifier:X', 'number:1']);
  });
  it('# dentro de una línea no inicia una directiva', () => {
    expect(dir('int a; # x')).toEqual(['int@-1', 'a@-1', ';@-1', '#@-1', 'x@-1']);
  });
  it('operadores # y ## dentro de #define', () => {
    expect(texts('#define CAT(a,b) a##b #a')).toEqual(['#', 'define', 'CAT', '(', 'a', ',', 'b', ')', 'a', '##', 'b', '#', 'a']);
  });
  it('la continuación con barra invertida extiende la directiva', () => {
    expect(dir('#define F(x) \\\n  (x)\nint')).toEqual(['#@0', 'define@0', 'F@0', '(@0', 'x@0', ')@0', '(@0', 'x@0', ')@0', 'int@-1']);
  });
  it('marca macros con parámetros y macros de objeto', () => {
    const fn = sig('#define f(x) x').find((t) => t.text === 'f')!;
    const obj = sig('#define f (x) x').find((t) => t.text === 'f')!;
    expect(fn.functionLikeMacro).toBe(true);
    expect(obj.functionLikeMacro).toBeUndefined();
    expect(obj.macroName).toBe(true);
  });
  it('un comentario de línea termina antes del salto que cierra la directiva', () => {
    expect(dir('#define N 5 // cinco\nint')).toEqual(['#@0', 'define@0', 'N@0', '5@0', '// cinco@0', 'int@-1']);
  });
});
