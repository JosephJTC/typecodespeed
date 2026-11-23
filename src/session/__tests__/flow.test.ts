import { describe, expect, it } from 'vitest';
import { TypingSession } from '../session';
import type { SessionConfig } from '../types';

function make(text: string, overrides: Partial<SessionConfig> = {}) {
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

const typed = (s: TypingSession) => s.editor.text.slice(0, s.editor.cursor);

const LOOP = 'int main() {\n    for (int t1 = 0; t1 < t; t1++) {\n        solve();\n    }\n    return 0;\n}';

describe('Enter al cerrar un bloque', () => {
  it.each(['tolerant', 'exact'] as const)('Enter tras la última línea del bloque deja el cursor antes de la llave insertada (%s)', (mode) => {
    const s = make(LOOP, { compare: { mode, comments: 'omit' } });
    s.input('int main() {\nfor (int t1 = 0; t1 < t; t1++) {\nsolve();\n');
    expect(typed(s).endsWith('solve();\n    ')).toBe(true);
    expect(s.editor.cells[s.editor.cursor]).toMatchObject({ ch: '}', ahead: true });
    s.move('right');
    s.input('\n');
    expect(typed(s).endsWith('solve();\n    }\n    ')).toBe(true);
    expect(s.editor.text).not.toContain('\n\n');
    s.input('return 0;\n}');
    expect(s.snapshot().errorsMade).toBe(0);
    expect(s.snapshot().finishReason).toBe('completed');
  });

  it('escribir la llave después del Enter también avanza sobre ella', () => {
    const s = make(LOOP);
    s.input('int main() {\nfor (int t1 = 0; t1 < t; t1++) {\nsolve();\n}\nreturn 0;\n}');
    expect(s.editor.text).toBe(LOOP);
    expect(s.snapshot().errorsMade).toBe(0);
    expect(s.snapshot().finishReason).toBe('completed');
  });

  it('si el bloque sigue en la referencia, Enter abre otra línea dentro y la llave queda en su propia línea', () => {
    const s = make('if (x) {\n    a();\n    b();\n}');
    s.input('if (x) {\na();\n');
    expect(s.editor.text).toBe('if (x) {\n    a();\n    \n}');
    s.input('b();\n}');
    expect(s.snapshot().errorsMade).toBe(0);
    expect(s.snapshot().finishReason).toBe('completed');
  });
});

describe('espacios al final que quedan después del cursor', () => {
  it.each(['tolerant', 'exact'] as const)('Enter, flecha arriba y seguir escribiendo no marca error (%s)', (mode) => {
    const s = make('int a;\nreturn 0;', { compare: { mode, comments: 'omit' } });
    s.input('int a;\n');
    s.input('\n');
    // In exact mode the extra blank line itself is a mistake when typed.
    const before = s.snapshot().errorsMade;
    s.move('up');
    s.input('r');
    expect(s.snapshot().errorsMade).toBe(before);
    expect(s.snapshot().uncorrected).toBe(0);
    const d = s.display();
    expect(d.text).toBe('int a;\nreturn 0;');
    expect(d.caret).toBe('int a;\nr'.length);
    s.input('eturn 0;');
    expect(s.snapshot().errorsMade).toBe(before);
    expect(s.snapshot().finishReason).toBe('completed');
  });

  it('la línea en blanco vuelve a evaluarse al escribir después de ella', () => {
    const s = make('int a;\nreturn 0;');
    s.input('int a;\n\n');
    s.move('up');
    s.input('r');
    s.move('down');
    s.input('x');
    expect(s.editor.text).toBe('int a;\nr\nx');
    expect(s.snapshot().errorsMade).toBeGreaterThan(0);
  });

  it('no aplaza espacios que tienen código después', () => {
    const s = make('int a;\nreturn 0;');
    s.input('int a;\nreturn 0');
    s.move('home');
    s.input('x');
    expect(s.snapshot().errorsMade).toBe(1);
    expect(s.editor.cells.some((c) => c.ahead)).toBe(false);
  });
});
