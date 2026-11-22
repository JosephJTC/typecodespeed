import { describe, expect, it } from 'vitest';
import { cpp, lexCpp } from '../languages/cpp';
import { needsSeparator } from '../separation';

/** Lexes `a b` and asks whether the two tokens need whitespace between them. */
function needs(a: string, b: string, prefix = ''): boolean {
  const toks = lexCpp(prefix + a + ' ' + b).filter((t) => t.type !== 'whitespace');
  const n = toks.length;
  return needsSeparator(toks[n - 2], toks[n - 1], cpp);
}

describe('needsSeparator: espacio obligatorio', () => {
  it.each([
    ['int', 'x'],
    ['return', '0'],
    ['unsigned', 'long'],
    ['long', 'long'],
    ['x', '1'],
    ['1', 'x'],
    ['1', '.5'],
    ['+', '+'],
    ['-', '-'],
    ['-', '>'],
    ['-', '='],
    ['<', '<'],
    ['>', '>'],
    ['>', '='],
    ['&', '&'],
    ['|', '|'],
    [':', ':'],
    ['/', '/'],
    ['/', '*'],
    ['<=', '>'],
    ['>', '>='],
    ['u8', '"x"'],
    ['L', "'a'"],
    ['R', '"(x)"'],
    ['"abc"', 's'],
    ["'a'", '_c'],
    ['1', 'e'],
  ])('%s · %s', (a, b) => {
    expect(needs(a, b)).toBe(true);
  });
});

describe('needsSeparator: espacio opcional', () => {
  it.each([
    ['int', '('],
    ['int', '*'],
    ['x', '='],
    ['=', '0'],
    [')', '{'],
    ['a', ';'],
    ['+', '-'],
    ['-', '+'],
    ['<', '::'],
    ['.', '.'],
    ['"a"', '"b"'],
    ['"a"', ';'],
    ['x', '"s"'],
    [')', 'const'],
    ['>', '<'],
    ['*', '/'],
  ])('%s · %s', (a, b) => {
    expect(needs(a, b)).toBe(false);
  });
});

describe('needsSeparator: preprocesador', () => {
  it('# e include pueden ir juntos', () => {
    expect(needs('#', 'include')).toBe(false);
  });
  it('include y la cabecera pueden ir juntos', () => {
    const toks = lexCpp('#include <vector>').filter((t) => t.type !== 'whitespace');
    expect(needsSeparator(toks[1], toks[2], cpp)).toBe(false);
  });
  it('define y el nombre de la macro necesitan espacio', () => {
    const toks = lexCpp('#define N 5').filter((t) => t.type !== 'whitespace');
    expect(needsSeparator(toks[1], toks[2], cpp)).toBe(true);
    expect(needsSeparator(toks[2], toks[3], cpp)).toBe(true);
  });
  it('un comentario de línea siempre necesita separación (salto de línea)', () => {
    const toks = lexCpp('// x\nint').filter((t) => t.type !== 'whitespace');
    expect(needsSeparator(toks[0], toks[1], cpp)).toBe(true);
  });
});
