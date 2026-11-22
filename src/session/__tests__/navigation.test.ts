import { describe, expect, it } from 'vitest';
import { evaluate } from '../../engine';
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

describe('edición con cursor libre', () => {
  it('corrige un carácter anterior con flechas y la prueba termina al quedar bien', () => {
    const s = make('int x = 1;');
    s.input('int x = 2;');
    expect(s.status).toBe('finished');
    const t = make('int x = 1;');
    t.input('int y = 1');
    t.move('home');
    t.move('wordRight');
    t.move('right');
    t.deleteForward();
    t.input('x');
    expect(t.editor.text).toBe('int x = 1');
    expect(t.snapshot().uncorrected).toBe(0);
    t.move('end');
    t.input(';');
    expect(t.snapshot().finishReason).toBe('completed');
    expect(t.snapshot().uncorrected).toBe(0);
  });

  it('el estado del motor coincide con evaluar el texto editado', () => {
    const s = make('for (int i = 0; i < n; i++) {\n    sum += a[i];\n}', { autoClose: false });
    s.input('for (int j = 0; j < n; j++) {\nsum += a[j];');
    s.move('up');
    s.move('home');
    for (let i = 0; i < 9; i++) s.move('right');
    s.backspace();
    s.input('i');
    const expected = evaluate(s.target, s.editor.text);
    expect(s.evaluator.pos).toBe(expected.pos);
    expect([...s.evaluator.states]).toEqual([...expected.states]);
  });

  it('editar una línea anterior con arriba y abajo', () => {
    const s = make('int a;\nint b;');
    s.input('int x;\nint b');
    s.move('up');
    expect(s.editor.cursor).toBe(5);
    s.backspace();
    s.input('a');
    s.move('down');
    expect(s.editor.cursor).toBe(12);
    s.input(';');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.snapshot().uncorrected).toBe(0);
  });

  it('Ctrl+Retroceso y Ctrl+Supr borran palabras', () => {
    const s = make('long long value = 10;');
    s.input('long long valeu');
    s.wordBackspace();
    expect(s.editor.text).toBe('long long ');
    s.input('value = 10');
    s.move('wordLeft');
    s.move('wordLeft');
    s.move('wordLeft');
    s.wordDelete();
    expect(s.editor.text).toBe('long long  = 10');
    s.input('value');
    expect(s.snapshot().uncorrected).toBe(0);
  });

  it('Supr al final no hace nada ni cuenta como corrección', () => {
    const s = make('ab');
    s.input('a');
    expect(s.deleteForward()).toBe(false);
    expect(s.snapshot().corrections).toBe(0);
  });

  it('una selección se reemplaza al escribir y se borra con Retroceso', () => {
    const s = make('int value;');
    s.input('int vlaue');
    s.move('wordLeft', true);
    s.input('value');
    expect(s.editor.text).toBe('int value');
    s.selectAll();
    s.backspace();
    expect(s.editor.text).toBe('');
    expect(s.snapshot().corrections).toBe(1);
  });

  it('Enter a media línea mantiene la indentación y la aumenta tras una llave', () => {
    const s = make('if (x) {\n    a();\n    b();\n}');
    s.input('if (x) {\na();');
    s.move('up');
    s.move('end');
    s.input('\n');
    expect(s.editor.text.split('\n')[1]).toBe('    ');
    s.move('down');
    s.move('end');
    s.input('\n');
    expect(s.editor.text.split('\n')[3]).toBe('    ');
  });

  it('navegar no inicia el reloj ni se registra en el historial de teclas', () => {
    const s = make('ab');
    s.move('right');
    s.move('end');
    expect(s.status).toBe('ready');
    s.input('a');
    s.move('home');
    expect(s.log.length).toBe(1);
  });

  it('navegar no cambia el progreso', () => {
    const s = make('int x;');
    s.input('int');
    const before = s.snapshot().doneChars;
    s.move('home');
    s.move('wordRight');
    expect(s.snapshot().doneChars).toBe(before);
  });

  it('al terminar, la navegación y la edición se ignoran', () => {
    const s = make('a;');
    s.input('a;');
    expect(s.status).toBe('finished');
    s.move('home');
    expect(s.backspace()).toBe(false);
    expect(s.editor.cursor).toBe(2);
  });

  it('el pegado no existe en la sesión: input escribe tecla por tecla con las mismas reglas', () => {
    const a = make('f(x);');
    a.input('f(x);');
    const b = make('f(x);');
    for (const ch of 'f(x);') b.input(ch);
    expect(a.editor.text).toBe(b.editor.text);
  });

  it('miles de ediciones aleatorias coinciden con evaluar el texto final', () => {
    const src = 'int main() {\n    vector<int> a(n);\n    for (auto &x : a) cin >> x;\n    return 0;\n}';
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) % n);
    const alphabet = 'int a(){}[]; \nxv<>&';
    const s = make(src, { idleTimeoutMs: 0 });
    for (let i = 0; i < 3000 && s.status !== 'finished'; i++) {
      const op = rnd(10);
      if (op < 5) s.input(alphabet[rnd(alphabet.length)]);
      else if (op === 5) s.backspace();
      else if (op === 6) s.deleteForward();
      else if (op === 7) s.move((['left', 'right', 'up', 'down', 'home', 'end'] as const)[rnd(6)], rnd(4) === 0);
      else if (op === 8) s.wordBackspace();
      else s.move('wordLeft');
      const ed = s.editor;
      let end = ed.length;
      while (end > 0 && ed.cells[end - 1].ahead) end--;
      const expected = evaluate(s.target, ed.text.slice(0, end));
      expect(s.evaluator.pos).toBe(expected.pos);
    }
  });
});
