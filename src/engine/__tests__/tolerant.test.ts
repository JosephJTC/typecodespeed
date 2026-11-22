import { describe, expect, it } from 'vitest';
import { buildTarget, evaluate, isEquivalent } from '..';
import type { CompareOptions } from '../types';

const TOL: CompareOptions = { mode: 'tolerant', comments: 'omit' };
const ok = (target: string, typed: string) => isEquivalent(target, typed, 'cpp', TOL);
const firstError = (target: string, typed: string) => evaluate(buildTarget(target, 'cpp', TOL), typed).results.find((r) => r.status === 'error')?.error;

describe('modo tolerante: espacios opcionales no penalizan', () => {
  it.each([
    ['int x;', 'int  x ;'],
    ['int x;', 'int\tx;'],
    ['a = b + c;', 'a=b+c;'],
    ['a=b+c;', 'a = b + c ;'],
    ['f(a, b);', 'f( a,b );'],
    ['if (x) {\n    y();\n}', 'if(x){y();}'],
    ['if (x) {\n    y();\n}', 'if (x)\n{\n\ty();\n}'],
    ['int main() {\n    return 0;\n}', 'int main(){return 0;}'],
    ['a;\n\n\nb;', 'a;\nb;'],
    ['a;\nb;', 'a;\n\n\n\nb;'],
    ['    int x;', 'int x;'],
    ['int x;', '        int x;'],
    ['vector<int> v;', 'vector < int > v ;'],
    ['std::cout << x;', 'std :: cout<<x;'],
    ['a[i] = b[j];', 'a [ i ]=b [ j ] ;'],
    ['p->x', 'p -> x'],
    ['x += 1;', 'x+=1;'],
    ['a ? b : c', 'a?b:c'],
    ['f(a...)', 'f(a ...)'],
    ['"x" "y"', '"x""y"'],
    ['a<::b', 'a < :: b'],
    ['int x;', 'int x;   \n\n'],
  ])('%j ≡ %j', (target, typed) => {
    expect(ok(target, typed)).toBe(true);
  });
});

describe('modo tolerante: espacios necesarios para separar tokens', () => {
  it.each([
    ['int x;', 'intx;'],
    ['return 0;', 'return0;'],
    ['unsigned long long x;', 'unsignedlong long x;'],
    ['long long x;', 'longlong x;'],
    ['a - -b', 'a--b'],
    ['a + +b', 'a++b'],
    ['a - --b', 'a---b'],
    ['x = a / *p;', 'x = a/*p;'],
    ['x < <y', 'x<<y'],
    ['auto s = u8 "x";', 'auto s = u8"x";'],
    ['auto s = "a" s;', 'auto s = "a"s;'],
    ['x = 1 .5;', 'x = 1.5;'],
    ['const int N = 5;', 'constint N = 5;'],
    ['a & &b', 'a&&b'],
  ])('%j ≢ %j', (target, typed) => {
    expect(ok(target, typed)).toBe(false);
  });

  it('reporta el error como separador faltante', () => {
    expect(firstError('int x;', 'intx;')).toBe('missingSeparator');
    expect(firstError('a - -b', 'a--b')).toBe('missingSeparator');
  });

  it('se recupera después del separador faltante (sigue sincronizado)', () => {
    const ev = evaluate(buildTarget('int x = 5;', 'cpp', TOL), 'intx = 5;');
    expect(ev.errors).toBe(1);
    expect(ev.complete).toBe(true);
    expect(ev.counts.correct).toBe(ev.counts.total);
  });
});

describe('modo tolerante: espacios dentro de tokens son errores', () => {
  it.each([
    ['x += 1;', 'x + = 1;'],
    ['a->b', 'a- >b'],
    ['std::cin', 'std: :cin'],
    ['a && b', 'a & & b'],
    ['vector<vector<int>> v;', 'vector<vector<int> > v;'],
    ['int count;', 'int cou nt;'],
    ['x = 1000;', 'x = 10 00;'],
    ['x = 1e-9;', 'x = 1e - 9;'],
    ['s = "a b";', 's = "a  b";'],
    ['s = "a b";', 's = "ab";'],
    ["c = ' ';", "c = '';"],
    ['f(a...)', 'f(a. ..)'],
  ])('%j ≢ %j', (target, typed) => {
    expect(ok(target, typed)).toBe(false);
  });

  it('un espacio dentro de un identificador es una inserción', () => {
    expect(firstError('int count;', 'int cou nt;')).toBe('insertion');
  });
});

describe('modo tolerante: el formato significativo se respeta', () => {
  it('una directiva necesita su salto de línea', () => {
    expect(ok('#include <cstdio>\nint a;', '#include <cstdio> int a;')).toBe(false);
    expect(firstError('#include <cstdio>\nint a;', '#include <cstdio> int a;')).toBe('missingNewline');
    expect(ok('#include <cstdio>\nint a;', '#include<cstdio>\n\n   int a;')).toBe(true);
  });
  it('no se puede partir una directiva en varias líneas', () => {
    expect(ok('#define N 100\nint a;', '#define N\n100\nint a;')).toBe(false);
    expect(firstError('#define N 100\nint a;', '#define N\n100\nint a;')).toBe('unexpectedNewline');
  });
  it('se permiten espacios extra dentro de una directiva', () => {
    expect(ok('#define N 100\nint a;', '#  define   N   100\nint a;')).toBe(true);
    expect(ok('#include <vector>\nint a;', '#include<vector>\nint a;')).toBe(true);
  });
  it('macro con parámetros: no se permite espacio antes de (', () => {
    expect(ok('#define f(x) x\n', '#define f (x) x')).toBe(false);
    expect(firstError('#define f(x) x\n', '#define f (x) x')).toBe('forbiddenWhitespace');
    expect(ok('#define f(x) x\n', '#define f( x ) x')).toBe(true);
  });
  it('macro de objeto: el espacio antes de ( es obligatorio', () => {
    expect(ok('#define f (x) x\n', '#define f(x) x')).toBe(false);
    expect(ok('#define f (x) x\n', '#define f   (x) x')).toBe(true);
  });
  it('los comentarios incluidos exigen salto de línea al terminar', () => {
    const opts: CompareOptions = { mode: 'tolerant', comments: 'include' };
    expect(isEquivalent('// hola\nint x;', '// hola int x;', 'cpp', opts)).toBe(false);
    expect(isEquivalent('// hola\nint x;', '//   hola\n  int x;', 'cpp', opts)).toBe(true);
  });
  it('tres símbolos que se fusionan (`. . .` → `...`)', () => {
    expect(ok('a . . . b', 'a ...b')).toBe(false);
  });
});

describe('modo tolerante: errores comunes', () => {
  it('sustitución de carácter', () => {
    const ev = evaluate(buildTarget('int x;', 'cpp', TOL), 'int y;');
    expect(ev.results.map((r) => r.error).filter(Boolean)).toEqual(['substitution']);
    expect(ev.counts.incorrect).toBe(1);
  });
  it('caracteres extra al final', () => {
    const ev = evaluate(buildTarget('x;', 'cpp', TOL), 'x;;');
    expect(ev.complete).toBe(true);
    expect(ev.counts.extra).toBe(1);
    expect(ev.errors).toBe(1);
  });
  it('texto incompleto no está completo', () => {
    const ev = evaluate(buildTarget('int x;', 'cpp', TOL), 'int x');
    expect(ev.complete).toBe(false);
    expect(ev.counts.remaining).toBe(1);
  });
});
