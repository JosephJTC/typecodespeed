import { describe, expect, it } from 'vitest';
import { TypingSession } from '../session';
import type { SessionConfig } from '../types';

const SRC = 'int main() {\n    return 0;\n}';

function make(text = SRC, overrides: Partial<SessionConfig> = {}) {
  let t = 0;
  return new TypingSession(text, {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: 'advance',
    autoIndent: true,
    autoClose: true,
    idleTimeoutMs: 0,
    hideGuide: true,
    now: () => (t += 50),
    ...overrides,
  });
}

const shown = (s: TypingSession) => {
  const d = s.display();
  return { text: d.text, codes: d.codes, before: d.text.slice(0, d.caret), after: d.text.slice(d.caret) };
};

describe('modo sin guía', () => {
  it('muestra el código antes de la primera tecla y lo oculta al empezar', () => {
    const s = make();
    expect(s.guideHidden).toBe(false);
    expect(shown(s).text).toBe(SRC);
    s.input('in');
    expect(s.guideHidden).toBe(true);
    expect(shown(s)).toMatchObject({ text: 'in', codes: 'cc', after: '' });
  });

  it('dibuja los cierres y saltos que insertó el editor donde están, sin el código pendiente', () => {
    const s = make();
    s.input('int main() {');
    expect(shown(s)).toMatchObject({ before: 'int main() {', after: '}' });
    s.input('\n');
    expect(shown(s)).toMatchObject({ before: 'int main() {\n    ', after: '\n}' });
    s.input('return 0;');
    expect(shown(s).text).not.toContain('return 0;\n}\n');
    expect(shown(s)).toMatchObject({ before: 'int main() {\n    return 0;', after: '\n}' });
  });

  it('un error muestra la tecla escrita, no la esperada, y se cuenta igual', () => {
    const s = make();
    s.input('int mxin');
    const d = shown(s);
    expect(d.text).toBe('int mxin');
    expect(d.codes[5]).toBe('i');
    const blind = s.snapshot();
    const seen = make(SRC, { hideGuide: false });
    seen.input('int mxin');
    expect(seen.display().text).toContain('int main');
    const normal = seen.snapshot();
    expect(blind.uncorrected).toBe(normal.uncorrected);
    expect(blind.errorsMade).toBe(normal.errorsMade);
    expect(blind.progress).toBe(normal.progress);
    expect(blind.correctChars).toBe(normal.correctChars);
  });

  it('borrar todo no vuelve a mostrar el código', () => {
    const s = make();
    s.input('int');
    s.backspace();
    s.backspace();
    s.backspace();
    expect(shown(s).text).toBe('');
  });

  it('termina la prueba igual que con guía', () => {
    const s = make();
    s.input('int main() {\nreturn 0;\n}');
    expect(s.snapshot()).toMatchObject({ status: 'finished', finishReason: 'completed', errorsMade: 0, uncorrected: 0 });
  });

  it('en pruebas por tiempo muestra cada texto nuevo hasta su primera tecla', () => {
    const texts = ['g();', 'h();'];
    const s = make('f();', { timeLimitMs: 60_000, nextText: () => texts.shift() ?? 'z;' });
    s.input('f();');
    expect(s.guideHidden).toBe(false);
    expect(shown(s).text).toBe('g();');
    s.input('g');
    expect(shown(s).text).toBe('g');
  });

  it('desactivado, sigue mostrando el código pendiente', () => {
    const s = make(SRC, { hideGuide: false });
    s.input('int');
    expect(s.guideHidden).toBe(false);
    expect(shown(s).after).toBe(' main() {\n    return 0;\n}');
  });
});
