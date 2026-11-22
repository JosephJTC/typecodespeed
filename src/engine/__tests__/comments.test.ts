import { describe, expect, it } from 'vitest';
import { buildTarget, isEquivalent, stripComments, cpp } from '..';
import type { CompareOptions } from '../types';

describe('omitir comentarios', () => {
  it('elimina líneas que solo tienen comentarios', () => {
    expect(stripComments('// título\nint a;\n  // nota\nint b;', cpp)).toBe('int a;\nint b;');
  });
  it('elimina comentarios al final de una línea', () => {
    expect(stripComments('int a; // nota\nint b;', cpp)).toBe('int a;\nint b;');
  });
  it('elimina comentarios de bloque multilínea', () => {
    expect(stripComments('/*\n * Doc\n */\nint a;', cpp)).toBe('int a;');
  });
  it('un comentario entre tokens se reemplaza por un espacio solo si hace falta', () => {
    expect(stripComments('int/**/x;', cpp)).toBe('int x;');
    expect(stripComments('f(/*a=*/1);', cpp)).toBe('f(1);');
    expect(stripComments('a = b /* x */ + c;', cpp)).toBe('a = b + c;');
  });
  it('no toca cadenas que parecen comentarios', () => {
    expect(stripComments('s = "// no"; // sí', cpp)).toBe('s = "// no";');
  });
  it('conserva el salto de línea de una directiva con comentario', () => {
    expect(stripComments('#define N 5 // cinco\nint a;', cpp)).toBe('#define N 5\nint a;');
  });
  it('el objetivo resultante no contiene comentarios', () => {
    const t = buildTarget('// x\nint a; /* y */', 'cpp', { mode: 'tolerant', comments: 'omit' });
    expect(t.text).toBe('int a;');
  });
});

describe('incluir comentarios', () => {
  const opts: CompareOptions = { mode: 'tolerant', comments: 'include' };
  it('hay que escribir el contenido del comentario', () => {
    expect(isEquivalent('// suma\nint a;', 'int a;', 'cpp', opts)).toBe(false);
    expect(isEquivalent('// suma\nint a;', '// suma\nint a;', 'cpp', opts)).toBe(true);
  });
  it('los espacios dentro del comentario se colapsan en modo tolerante', () => {
    expect(isEquivalent('// suma de prefijos\nint a;', '//  suma   de prefijos\nint a;', 'cpp', opts)).toBe(true);
    expect(isEquivalent('// suma de prefijos\nint a;', '// sumade prefijos\nint a;', 'cpp', opts)).toBe(false);
  });
  it('en modo exacto los espacios del comentario son exactos', () => {
    const exact: CompareOptions = { mode: 'exact', comments: 'include' };
    expect(isEquivalent('// a  b\nx;', '// a b\nx;', 'cpp', exact)).toBe(false);
    expect(isEquivalent('// a  b\nx;', '// a  b\nx;', 'cpp', exact)).toBe(true);
  });
});
