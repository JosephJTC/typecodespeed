import { describe, expect, it } from 'vitest';
import { buildDisplay, buildTarget, Evaluator, ghostWhitespace } from '..';
import type { CompareOptions } from '..';

const SRC = 'int main() {\n    int x = 1;\n\n    return x;\n}';

function show(typed: string, source = SRC, options: CompareOptions = { mode: 'tolerant', comments: 'include' }) {
  const ev = new Evaluator(buildTarget(source, 'cpp', options));
  for (const ch of typed) ev.push(ch);
  const d = buildDisplay(ev);
  return { ...d, done: d.text.slice(0, d.caret), ghost: d.text.slice(d.caret), ev };
}

describe('ghostWhitespace', () => {
  it.each([
    ['\n    ', '', '\n    '],
    ['\n    ', '\n', '    '],
    ['\n    ', '\n  ', '  '],
    ['\n    ', '\n      ', ''],
    ['\n    ', ' ', '\n    '],
    ['\n\n    ', '\n', '\n    '],
    ['\n\n    ', '\n\n\n', '    '],
    [' ', ' ', ''],
    [' ', '   ', ''],
    ['  ', ' ', ' '],
    [' ', '\n', ''],
    ['', '  ', ''],
  ])('ref %j, escrito %j → %j', (ref, typed, rest) => {
    expect(ghostWhitespace(ref, typed)).toBe(rest);
  });
});

describe('buildDisplay', () => {
  it('sin escribir nada muestra la referencia completa como pendiente', () => {
    const d = show('');
    expect(d.text).toBe(SRC);
    expect(d.caret).toBe(0);
    expect(d.codes).toBe('p'.repeat(SRC.length));
  });

  it('conserva los espacios extra que el usuario escribió y desplaza el resto', () => {
    const d = show('int   main (  ) ');
    expect(d.done).toBe('int   main (  ) ');
    expect(d.ghost).toBe('{\n    int x = 1;\n\n    return x;\n}');
  });

  it('si se omite un espacio opcional, el texto pendiente se pega a lo escrito', () => {
    expect(show('int main(){int x=').ghost.startsWith(' 1;\n')).toBe(true);
    const d = show('int main(){int x=1');
    expect(d.done).toBe('int main(){int x=1');
    expect(d.ghost.startsWith(';\n')).toBe(true);
  });

  it('muestra las líneas en blanco escritas y ajusta la indentación sugerida', () => {
    const d = show('int main() {\n\n\n  ');
    expect(d.done).toBe('int main() {\n\n\n  ');
    expect(d.ghost.startsWith('  int x')).toBe(true);
  });

  it('no vuelve a sugerir un salto de línea ya escrito', () => {
    expect(show('int main() {\n').ghost.startsWith('    int x')).toBe(true);
    expect(show('int main() {').ghost.startsWith('\n    int x')).toBe(true);
    expect(show('int main() { ').ghost.startsWith('\n    int x')).toBe(true);
  });

  it('un salto donde la referencia no lo tiene mueve el resto a la línea nueva', () => {
    const d = show('int\nmain');
    expect(d.done).toBe('int\nmain');
    expect(d.ghost.startsWith('() {')).toBe(true);
  });

  it('marca los caracteres incorrectos y los separadores omitidos', () => {
    const d = show('intm');
    expect(d.done).toBe('int␣m');
    expect(d.codes.slice(0, 5)).toBe('cccmc');
    const e = show('ixt');
    expect(e.codes.slice(0, 3)).toBe('cic');
    expect(e.done).toBe('int');
  });

  it('muestra los caracteres sobrantes tal como se escribieron', () => {
    const d = show('#define F (x)', '#define F(x) x\n');
    expect(d.done).toBe('#define F (x)');
    expect(d.codes[9]).toBe('x');
  });

  it('en modo exacto marca el formato omitido sin inventar espacios', () => {
    const d = show('int main() {\nint', SRC, { mode: 'exact', comments: 'include' });
    expect(d.done).toBe('int main() {\n␣␣␣␣int');
    expect(d.ghost.startsWith(' x = 1;')).toBe(true);
  });

  it('retroceder devuelve la vista al estado anterior', () => {
    const { ev } = show('int   main (\n\n');
    const before = show('int   main');
    for (let i = 0; i < 4; i++) ev.pop();
    expect(buildDisplay(ev)).toMatchObject({ text: before.text, codes: before.codes, caret: before.caret });
  });

  it('al terminar no queda texto pendiente', () => {
    const d = show('int main(){int x=1;return x;}');
    expect(d.ev.complete).toBe(true);
    expect(d.ghost.trim()).toBe('');
  });

  it('text y codes siempre miden lo mismo', () => {
    const typed = 'int  main( ) {\n\n  int y = 1 ;\nretrun x;}}  ';
    for (let n = 0; n <= typed.length; n++) {
      const d = show(typed.slice(0, n));
      expect(d.codes.length).toBe(d.text.length);
    }
  });
});
