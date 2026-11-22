import { describe, expect, it } from 'vitest';
import { buildDisplay } from '../../engine';
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

const typed = (s: TypingSession) => {
  const d = buildDisplay(s.evaluator, { autoClose: true });
  return d.text.slice(0, d.caret);
};

describe('cierre automático de paréntesis, corchetes y llaves', () => {
  it('cierra de inmediato un par vacío', () => {
    const s = make();
    s.input('int main(');
    expect(typed(s)).toBe('int main()');
  });

  it('cierra el par al llegar a él, con el salto y la indentación de la referencia', () => {
    const s = make();
    s.input('int main() {\nint a[3');
    expect(typed(s)).toBe('int main() {\n    int a[3]');
    s.input(';\nf(g(a[0');
    expect(typed(s)).toBe('int main() {\n    int a[3];\n    f(g(a[0]))');
    s.input(';\nreturn 0;');
    expect(typed(s)).toBe(SRC);
    const snap = s.snapshot();
    expect(snap.status).toBe('finished');
    expect(snap.finishReason).toBe('completed');
    expect(snap.uncorrected).toBe(0);
    expect(snap.errorsMade).toBe(0);
  });

  it('escribir a mano el cierre ya insertado no cuenta como error ni lo duplica', () => {
    const s = make();
    s.input('int main() {\nint a[3];\nf(g(a[0]));');
    expect(typed(s)).toBe('int main() {\n    int a[3];\n    f(g(a[0]));');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('un cierre de más sí es un error', () => {
    const s = make();
    s.input('int main())');
    expect(s.snapshot().errorsMade).toBe(1);
  });

  it('no cierra si la apertura se escribió mal', () => {
    const s = make();
    s.input('int main[');
    expect(typed(s)).toBe('int main(');
    expect(s.evaluator.states.filter((x) => x === 'correct').length).toBe(7);
  });

  it('retroceso borra la tecla junto con los cierres que insertó', () => {
    const s = make();
    s.input('int main(');
    s.backspace();
    expect(typed(s)).toBe('int main');
    s.input('(');
    expect(typed(s)).toBe('int main()');
  });

  it('las teclas automáticas no cuentan como pulsaciones', () => {
    const s = make('f(x);');
    s.input('f(x;');
    expect(s.snapshot().status).toBe('finished');
    expect(s.log.filter((k) => !k.auto).length).toBe(4);
    expect(s.log.filter((k) => k.auto).map((k) => k.ch)).toEqual([')']);
  });

  it('ignora los paréntesis dentro de cadenas, caracteres y comentarios', () => {
    const s = make('f("(", \')\'); // (\ng();', { compare: { mode: 'tolerant', comments: 'include' } });
    s.input('f("(", \'');
    expect(typed(s)).toBe('f("(", \'');
    s.input(')\'');
    expect(typed(s)).toBe('f("(", \')\')');
  });

  it('desactivado, no inserta nada', () => {
    const s = make(SRC, { autoClose: false });
    s.input('int main(');
    expect(typed(s)).toBe('int main(');
  });

  it('en modo exacto reproduce el formato antes del cierre', () => {
    const s = make('if (a) {\n  b();\n}', { compare: { mode: 'exact', comments: 'include' } });
    s.input('if (a) {\nb(;');
    expect(typed(s)).toBe('if (a) {\n  b();\n}');
    expect(s.snapshot().status).toBe('finished');
  });

  it('en modo bloquear tampoco rechaza el cierre escrito a mano', () => {
    const s = make('f(x);', { errorPolicy: 'block' });
    expect(s.input('f(x);').rejected).toBe(0);
    expect(s.snapshot().status).toBe('finished');
  });

  it('marca como ya insertados los cierres pendientes', () => {
    const s = make();
    s.input('int main() {');
    const d = buildDisplay(s.evaluator, { autoClose: true });
    expect(d.text).toBe(SRC);
    expect([...d.codes].map((c, i) => (c === 'a' ? i : -1)).filter((i) => i >= 0)).toEqual([SRC.length - 1]);
  });

  it.each(SAMPLES.map((x) => [x.name, x.code] as const))('%s se completa sin errores omitiendo todos los cierres', (_name, code) => {
    const s = make(code);
    let guard = 0;
    while (s.status !== 'finished' && guard++ < 20000) {
      const items = s.target.items;
      const item = items[s.evaluator.pos];
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
    expect(s.log.some((k) => k.auto && '}])'.includes(k.ch!))).toBe(true);
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
