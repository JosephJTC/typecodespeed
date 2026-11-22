import { describe, expect, it } from 'vitest';
import { buildTarget, evaluate, isEquivalent } from '..';
import type { CompareOptions, WhitespaceRules } from '../types';

const custom = (rules: Partial<WhitespaceRules>): CompareOptions => ({
  mode: 'custom',
  comments: 'omit',
  custom: { indentation: 'exact', inlineSpaces: 'exact', lineBreaks: 'exact', blankLines: 'exact', ...rules },
});

const CODE = 'int main() {\n    int a = 1;\n\n    return a;\n}';

describe('modo personalizado: indentación', () => {
  const opts = custom({ indentation: 'ignore' });
  it('ignora la indentación', () => {
    expect(isEquivalent(CODE, 'int main() {\nint a = 1;\n\nreturn a;\n}', 'cpp', opts)).toBe(true);
    expect(isEquivalent(CODE, 'int main() {\n\t\tint a = 1;\n\n  return a;\n}', 'cpp', opts)).toBe(true);
  });
  it('mantiene exactos los espacios internos', () => {
    expect(isEquivalent(CODE, 'int main() {\nint a=1;\n\nreturn a;\n}', 'cpp', opts)).toBe(false);
  });
  it('mantiene exactos los saltos de línea', () => {
    expect(isEquivalent(CODE, 'int main() { int a = 1;\n\nreturn a;\n}', 'cpp', opts)).toBe(false);
  });
});

describe('modo personalizado: colapsar espacios', () => {
  const opts = custom({ inlineSpaces: 'collapse' });
  it('varios espacios equivalen a uno', () => {
    expect(isEquivalent(CODE, 'int   main()  {\n    int a  =   1;\n\n    return  a;\n}', 'cpp', opts)).toBe(true);
  });
  it('pero no se puede eliminar un espacio existente', () => {
    expect(isEquivalent(CODE, 'int main() {\n    int a=1;\n\n    return a;\n}', 'cpp', opts)).toBe(false);
  });
  it('ni agregar uno donde no lo hay', () => {
    expect(isEquivalent(CODE, 'int main ( ) {\n    int a = 1;\n\n    return a;\n}', 'cpp', opts)).toBe(false);
  });
});

describe('modo personalizado: espacios según tokens con líneas exactas', () => {
  const opts = custom({ inlineSpaces: 'lexical', indentation: 'ignore' });
  it('permite reformatear dentro de cada línea', () => {
    expect(isEquivalent(CODE, 'int main(){\nint a=1;\n\nreturn a;\n}', 'cpp', opts)).toBe(true);
  });
  it('sigue exigiendo los separadores', () => {
    expect(isEquivalent(CODE, 'int main(){\ninta=1;\n\nreturn a;\n}', 'cpp', opts)).toBe(false);
  });
  it('no permite juntar líneas', () => {
    expect(isEquivalent(CODE, 'int main(){ int a=1;\n\nreturn a;\n}', 'cpp', opts)).toBe(false);
  });
  it('acepta espacios al final de una línea', () => {
    expect(isEquivalent(CODE, 'int main(){   \nint a=1;\n\nreturn a;\n}', 'cpp', opts)).toBe(true);
  });
});

describe('modo personalizado: líneas en blanco', () => {
  it('ignora líneas en blanco extra o faltantes', () => {
    const opts = custom({ blankLines: 'ignore' });
    expect(isEquivalent(CODE, 'int main() {\n    int a = 1;\n    return a;\n}', 'cpp', opts)).toBe(true);
    expect(isEquivalent(CODE, 'int main() {\n\n    int a = 1;\n\n\n    return a;\n}', 'cpp', opts)).toBe(true);
  });
  it('sigue exigiendo al menos un salto de línea', () => {
    const opts = custom({ blankLines: 'ignore' });
    expect(isEquivalent(CODE, 'int main() {    int a = 1;\n    return a;\n}', 'cpp', opts)).toBe(false);
  });
  it('con líneas en blanco exactas, una línea extra es error', () => {
    expect(isEquivalent(CODE, 'int main() {\n    int a = 1;\n    return a;\n}', 'cpp', custom({}))).toBe(false);
  });
});

describe('modo personalizado: saltos de línea flexibles', () => {
  const opts = custom({ lineBreaks: 'flexible', inlineSpaces: 'collapse' });
  it('un salto de línea equivale a un espacio', () => {
    expect(isEquivalent('int a;\nint b;', 'int a; int b;', 'cpp', opts)).toBe(true);
    expect(isEquivalent('int a; int b;', 'int a;\nint b;', 'cpp', opts)).toBe(true);
  });
  it('pero sigue exigiendo al menos un espacio donde lo había', () => {
    expect(isEquivalent('int a;\nint b;', 'int a;int b;', 'cpp', opts)).toBe(false);
  });
});

describe('modo personalizado: diagnóstico de espacios exigidos por formato', () => {
  const opts = custom({ lineBreaks: 'flexible', inlineSpaces: 'collapse' });
  const firstError = (src: string, typed: string) =>
    evaluate(buildTarget(src, 'cpp', opts), typed).results.find((r) => r.error)?.error;
  it('distingue el espacio de formato del separador léxico', () => {
    expect(firstError('if (x) {\n  y();\n}', 'if (x) {y();}')).toBe('missingWhitespace');
    expect(firstError('int x;', 'intx;')).toBe('missingSeparator');
  });
});
