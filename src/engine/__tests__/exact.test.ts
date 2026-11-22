import { describe, expect, it } from 'vitest';
import { buildTarget, evaluate, isEquivalent, normalizeSource } from '..';
import type { CompareOptions } from '../types';
import { CORPUS } from './fixtures';

const EXACT: CompareOptions = { mode: 'exact', comments: 'include' };
const ok = (target: string, typed: string) => isEquivalent(target, typed, 'cpp', EXACT);

describe('modo exacto', () => {
  it.each(Object.entries(CORPUS))('acepta la reproducción exacta: %s', (_name, src) => {
    expect(ok(src, normalizeSource(src))).toBe(true);
  });
  it.each([
    ['int x;', 'int  x;'],
    ['a = b;', 'a=b;'],
    ['if (x) {\n    y();\n}', 'if (x) {\ny();\n}'],
    ['if (x) {\n    y();\n}', 'if (x) {\n\ty();\n}'],
    ['if (x) {\n    y();\n}', 'if (x) { y(); }'],
    ['a;\n\nb;', 'a;\nb;'],
    ['a;\nb;', 'a;\n\nb;'],
    ['f(a, b);', 'f(a,b);'],
  ])('%j ≢ %j', (target, typed) => {
    expect(ok(target, typed)).toBe(false);
  });

  it('ignora espacios finales de línea y CRLF del archivo original', () => {
    expect(ok('int x;   \r\nint y;\r\n', 'int x;\nint y;')).toBe(true);
  });

  it('un espacio faltante se marca y no desincroniza', () => {
    const ev = evaluate(buildTarget('int x = 5;', 'cpp', EXACT), 'int x =5;');
    expect(ev.results.find((r) => r.error)?.error).toBe('missingWhitespace');
    expect(ev.errors).toBe(1);
    expect(ev.complete).toBe(true);
  });

  it('indentación faltante se reporta como espacio faltante', () => {
    const ev = evaluate(buildTarget('{\n    x;\n}', 'cpp', EXACT), '{\nx;\n}');
    expect(ev.errors).toBe(1);
    expect(ev.results.find((r) => r.error)?.error).toBe('missingWhitespace');
  });

  it('un salto de línea faltante se reporta como tal', () => {
    const ev = evaluate(buildTarget('a;\nb;', 'cpp', EXACT), 'a;b;');
    expect(ev.results.find((r) => r.error)?.error).toBe('missingNewline');
  });

  it('dentro de cadenas los espacios siempre son exactos', () => {
    expect(ok('s = "a  b";', 's = "a b";')).toBe(false);
  });
});
