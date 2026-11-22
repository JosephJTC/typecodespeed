import { describe, expect, it } from 'vitest';
import { SAMPLES } from '../../snippets/samples';
import { TypingSession } from '../session';
import type { SessionConfig } from '../types';

const SRC = 'int main() {\n    int a[3];\n    f(g(a[0]));\n    return 0;\n}';

function make(text = SRC, overrides: Partial<SessionConfig> = {}) {
  let t = 0;
  return new TypingSession(text, {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: 'advance',
    autoIndent: true,
    autoClose: true,
    idleTimeoutMs: 0,
    now: () => (t += 50),
    ...overrides,
  });
}

/** Edited text up to the cursor. */
const typed = (s: TypingSession) => s.editor.text.slice(0, s.editor.cursor);
const text = (s: TypingSession) => s.editor.text;

describe('cierre automático de paréntesis, corchetes y llaves', () => {
  it.each([
    ['(', '()'],
    ['[', '[]'],
    ['{', '{}'],
  ])('%s inserta el par de inmediato con el cursor en medio', (open, pair) => {
    const s = make('x' + pair + ';');
    s.input('x' + open);
    expect(text(s)).toBe('x' + pair);
    expect(s.editor.cursor).toBe(2);
    expect(s.editor.cells[2].auto).toBe(true);
  });

  it('anida pares y los cierra de adentro hacia afuera', () => {
    const s = make('f(g(a[0]));');
    s.input('f(g(a[');
    expect(text(s)).toBe('f(g(a[]))');
    expect(typed(s)).toBe('f(g(a[');
    s.input('0]))');
    expect(text(s)).toBe('f(g(a[0]))');
    expect(s.editor.cursor).toBe(10);
    s.input(';');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('pares consecutivos', () => {
    const s = make('f()[0]{};');
    s.input('f()[0]{}');
    expect(text(s)).toBe('f()[0]{}');
    s.input(';');
    expect(s.snapshot().errorsMade).toBe(0);
    expect(s.status).toBe('finished');
  });

  it('escribir el cierre insertado avanza sobre él sin duplicarlo ni contar error', () => {
    const s = make('f(x);');
    s.input('f(x)');
    expect(text(s)).toBe('f(x)');
    expect(s.editor.cells.every((c) => !c.auto)).toBe(true);
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('un cierre de más sí se inserta y es un error', () => {
    const s = make();
    s.input('int main())');
    expect(text(s)).toBe('int main())');
    expect(s.snapshot().errorsMade).toBe(1);
  });

  it('el cierre pendiente no cuenta como progreso, pulsación ni acierto', () => {
    const s = make('f();');
    s.input('f(');
    const snap = s.snapshot();
    expect(snap.doneChars).toBe(2);
    expect(snap.correctChars).toBe(2);
    expect(s.log.length).toBe(2);
    expect(s.log.some((k) => k.ch === ')')).toBe(false);
  });

  it('las teclas automáticas no inflan WPM ni precisión', () => {
    const s = make('f(x);');
    s.input('f(x);');
    expect(s.status).toBe('finished');
    expect(s.log.filter((k) => !k.auto).length).toBe(5);
    expect(s.log.filter((k) => k.auto)).toEqual([]);
    expect(s.snapshot().sessionCorrectChars).toBe(5);
    expect(s.snapshot().accuracy).toBe(1);
  });

  it('escribir después del cierre lo vuelve parte del texto evaluado', () => {
    const s = make('f();');
    s.input('f(');
    s.move('end');
    s.input(';');
    expect(text(s)).toBe('f();');
    expect(s.status).toBe('finished');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('una apertura equivocada también se cierra y el error queda solo en ella', () => {
    const s = make();
    s.input('int main[');
    expect(text(s)).toBe('int main[]');
    expect(s.snapshot().errorsMade).toBe(1);
    s.backspace();
    expect(text(s)).toBe('int main');
    s.input('(');
    expect(text(s)).toBe('int main()');
  });

  it('corrige un cierre equivocado sin romper el par', () => {
    const s = make('a[0];');
    s.input('a[0');
    s.move('right');
    s.backspace();
    expect(text(s)).toBe('a[0');
    s.input(']');
    expect(text(s)).toBe('a[0]');
    expect(s.snapshot().uncorrected).toBe(0);
  });

  it('Enter entre llaves deja el cierre en su propia línea', () => {
    const s = make('if (x) {\n    a();\n}');
    s.input('if (x) {\n');
    expect(text(s)).toBe('if (x) {\n    \n}');
    expect(typed(s)).toBe('if (x) {\n    ');
    s.input('a();');
    s.move('end');
    expect(s.editor.cursor).toBe('if (x) {\n    a();'.length);
    s.input('\n}');
    expect(text(s)).toBe('if (x) {\n    a();\n}');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('retroceso tras Enter entre llaves vuelve a juntar el par', () => {
    const s = make('if (x) {\n    a();\n}');
    s.input('if (x) {\n');
    s.backspace();
    expect(text(s)).toBe('if (x) {}');
    s.backspace();
    expect(text(s)).toBe('if (x) ');
  });

  it('retroceso en un par vacío autogenerado borra ambos', () => {
    const s = make('f();');
    s.input('f(');
    expect(s.backspace()).toBe(true);
    expect(text(s)).toBe('f');
  });

  it('retroceso con contenido dentro del par borra solo el carácter', () => {
    const s = make('f(x);');
    s.input('f(x');
    s.backspace();
    expect(text(s)).toBe('f()');
    s.backspace();
    expect(text(s)).toBe('f');
  });

  it('retroceso no borra un cierre escrito a mano', () => {
    const s = make('f();', { autoClose: false });
    s.input('f()');
    s.move('left');
    s.backspace();
    expect(text(s)).toBe('f)');
  });

  it('no inserta el par antes de un identificador', () => {
    const s = make('f(x);');
    s.input('fx');
    s.move('left');
    s.input('(');
    expect(text(s)).toBe('f(x');
  });

  it('no inserta pares dentro de cadenas, caracteres ni comentarios', () => {
    const s = make('f("(", \'[\'); // {\ng();', { compare: { mode: 'tolerant', comments: 'include' } });
    s.input('f("(');
    expect(text(s)).toBe('f("()');
    s.input('", \'[');
    expect(text(s)).toBe('f("(", \'[)');
    s.input('\'');
    s.move('right');
    s.input('; // {');
    expect(text(s)).toBe('f("(", \'[\'); // {');
  });

  it('desactivado, no inserta nada', () => {
    const s = make(SRC, { autoClose: false });
    s.input('int main(');
    expect(text(s)).toBe('int main(');
  });

  it('en modo exacto reproduce la indentación y avanza sobre los cierres', () => {
    const s = make('if (a) {\n  b();\n}', { compare: { mode: 'exact', comments: 'include' } });
    s.input('if (a) {\nb();\n}');
    expect(text(s)).toBe('if (a) {\n  b();\n}');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('en modo personalizado también funciona', () => {
    const s = make('g(a, b);', { compare: { mode: 'custom', comments: 'omit', custom: { indentation: 'ignore', inlineSpaces: 'collapse', lineBreaks: 'flexible', blankLines: 'ignore' } } });
    s.input('g(a, b);');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('en modo bloquear acepta los cierres y rechaza un error sin dejar rastro', () => {
    const s = make('f(x);', { errorPolicy: 'block' });
    expect(s.input('f[').rejected).toBe(1);
    expect(text(s)).toBe('f');
    expect(s.input('(x);').rejected).toBe(0);
    expect(s.snapshot().finishReason).toBe('completed');
  });

  it('dibuja el cierre pendiente en su lugar dentro del código por escribir', () => {
    const s = make();
    s.input('int main() {');
    const d = s.display();
    expect(d.text).toBe(SRC);
    expect([...d.codes].map((c, i) => (c === 'a' ? i : -1)).filter((i) => i >= 0)).toEqual([SRC.length - 1]);
    expect(d.caret).toBe('int main() {'.length);
  });

  it('una pausa y un reinicio de segmento no dejan pares colgando', () => {
    let next = 0;
    const s = make('f();', { timeLimitMs: 60_000, nextText: () => ['g();', 'h();'][next++ % 2] });
    s.input('f(');
    s.pause();
    s.input(');');
    expect(text(s)).toBe('');
    s.input('g(');
    expect(text(s)).toBe('g()');
  });

  it.each(SAMPLES.map((x) => [x.name, x.code] as const))('%s se completa sin errores', (_name, code) => {
    const s = make(code);
    let guard = 0;
    while (s.status !== 'finished' && guard++ < 20000) {
      const items = s.target.items;
      const item = items[s.evaluator.pos];
      if (!item) break;
      if (item.kind === 'char') s.input(item.ch);
      else if (s.evaluator.gapTyped === 0 && (item.min > 0 || item.requireNewline)) s.input(item.requireNewline ? '\n' : ' ');
      else {
        const next = items.slice(s.evaluator.pos + 1).find((it) => it.kind === 'char');
        if (!next || next.kind !== 'char') break;
        s.input(next.ch);
      }
    }
    const snap = s.snapshot();
    expect(snap.finishReason).toBe('completed');
    expect(snap.errorsMade).toBe(0);
  });
});

describe('indentación automática', () => {
  it('Enter indenta la línea nueva como la referencia', () => {
    const s = make();
    s.input('int main() {\n');
    expect(typed(s)).toBe('int main() {\n    ');
    s.input('int a[3];\n');
    expect(typed(s)).toBe('int main() {\n    int a[3];\n    ');
  });

  it('un salto propio a media línea conserva la indentación de esa línea', () => {
    const s = make();
    s.input('int main() {\nint\n');
    expect(typed(s)).toBe('int main() {\n    int\n    ');
  });

  it('retroceso deshace el salto y su indentación juntos', () => {
    const s = make();
    s.input('int main() {\n');
    s.backspace();
    expect(typed(s)).toBe('int main() {');
  });

  it('desactivada, no indenta', () => {
    const s = make(SRC, { autoIndent: false });
    s.input('int main() {\n');
    expect(typed(s)).toBe('int main() {\n');
  });

  it('no indenta dentro de una directiva ni rompe el salto obligatorio', () => {
    const s = make('#define N 5\n  int x;');
    s.input('#define N 5\nint x;');
    expect(s.snapshot().errorsMade).toBe(0);
    expect(typed(s)).toBe('#define N 5\n  int x;');
  });
});
