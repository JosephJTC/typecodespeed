import { describe, expect, it } from 'vitest';
import { evaluate } from '../../engine';
import { pick, rng } from '../../lib/random';
import { TypingSession } from '../session';
import type { SessionConfig } from '../types';

class FakeClock {
  t = 1000;
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
}

function make(text: string, overrides: Partial<SessionConfig> = {}, clock = new FakeClock()) {
  const config: SessionConfig = {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: 'advance',
    autoIndent: true,
    idleTimeoutMs: 0,
    now: clock.now,
    ...overrides,
  };
  return { s: new TypingSession(text, config), clock };
}

/** Types one character at a time, advancing the clock between keys. */
function typeSlowly(s: TypingSession, clock: FakeClock, text: string, ms = 100) {
  for (const ch of text) {
    s.input(ch);
    clock.advance(ms);
  }
}

const CODE = 'int main() {\n    int x = a+b;\n    return x;\n}';

describe('sesión: progreso y finalización', () => {
  it('empieza en estado listo y el cronómetro arranca con la primera tecla', () => {
    const { s, clock } = make(CODE);
    expect(s.status).toBe('ready');
    clock.advance(5000);
    expect(s.snapshot().elapsedMs).toBe(0);
    s.input('i');
    clock.advance(250);
    expect(s.status).toBe('running');
    expect(s.snapshot().elapsedMs).toBe(250);
  });

  it('termina al escribir el último carácter correcto y luego ignora la entrada', () => {
    const { s, clock } = make('a+b;');
    typeSlowly(s, clock, 'a+b;');
    expect(s.status).toBe('finished');
    expect(s.snapshot().finishReason).toBe('completed');
    expect(s.input('x')).toEqual({ accepted: 0, rejected: 0, ignored: 1 });
    expect(s.backspace()).toBe(false);
    expect(s.snapshot().progress).toBe(1);
  });

  it('no termina si el último carácter es incorrecto hasta corregirlo', () => {
    const { s } = make('a+b;');
    s.input('a+b,');
    expect(s.status).toBe('running');
    s.backspace();
    s.input(';');
    expect(s.status).toBe('finished');
  });

  it('acepta formato distinto en modo tolerante y completa el código', () => {
    const { s } = make(CODE);
    s.input('int main(){\nint x=a + b;\nreturn x;\n}');
    expect(s.status).toBe('finished');
    const snap = s.snapshot();
    expect(snap.errorsMade).toBe(0);
    expect(snap.uncorrected).toBe(0);
    expect(snap.tokensCorrect).toBe(snap.tokensTotal);
  });

  it('cuenta caracteres y tokens avanzados', () => {
    const { s } = make('int x = 10;');
    s.input('int x');
    let snap = s.snapshot();
    expect(snap.totalChars).toBe('intx=10;'.length);
    expect(snap.doneChars).toBe(4);
    expect(snap.tokensTotal).toBe(5);
    expect(snap.tokensDone).toBe(2);
    s.input(' = 1');
    snap = s.snapshot();
    expect(snap.tokensDone).toBe(3);
    expect(snap.progress).toBeCloseTo(6 / 8);
  });

  it('reporta la línea del cursor', () => {
    const { s } = make(CODE);
    expect(s.snapshot().line).toBe(1);
    s.input('int main() {\n');
    expect(s.snapshot().line).toBe(2);
    expect(s.snapshot().lines).toBe(4);
  });
});

describe('sesión: errores y correcciones', () => {
  it('modo avanzar: marca el error, avanza y cuenta precisión', () => {
    const { s } = make('abc;');
    s.input('axc');
    const snap = s.snapshot();
    expect(snap.doneChars).toBe(3);
    expect(snap.errorsMade).toBe(1);
    expect(snap.uncorrected).toBe(1);
    expect(snap.accuracy).toBeCloseTo(2 / 3);
    expect(snap.errorsByKind.substitution).toBe(1);
  });

  it('corregir con retroceso elimina el error actual pero no del historial', () => {
    const { s } = make('abc;');
    s.input('ax');
    s.backspace();
    s.input('b');
    const snap = s.snapshot();
    expect(snap.uncorrected).toBe(0);
    expect(snap.errorsMade).toBe(1);
    expect(snap.corrections).toBe(1);
  });

  it('modo bloquear: rechaza teclas incorrectas sin mover el cursor', () => {
    const { s } = make('int x;', { errorPolicy: 'block' });
    const r = s.input('inntx x;');
    expect(r.rejected).toBe(2); // 'n' repetida y 'x' sin separador
    expect(s.status).toBe('finished');
    const snap = s.snapshot();
    expect(snap.uncorrected).toBe(0);
    expect(snap.errorsMade).toBe(2);
    expect(snap.errorsByKind.missingSeparator).toBe(1);
  });

  it('separador faltante se reporta como tal', () => {
    const { s } = make('return 0;');
    s.input('return0');
    expect(s.snapshot().errorsByKind.missingSeparator).toBe(1);
  });

  it('caracteres de más se cuentan como errores sin corregir', () => {
    const { s } = make('ab;', { compare: { mode: 'exact', comments: 'omit' } });
    s.input('a b');
    expect(s.snapshot().uncorrected).toBeGreaterThan(0);
    s.backspace();
    s.backspace();
    s.input('b;');
    expect(s.status).toBe('finished');
    expect(s.snapshot().uncorrected).toBe(0);
  });

  it('retroceso al inicio no hace nada', () => {
    const { s } = make('a;');
    expect(s.backspace()).toBe(false);
    expect(s.snapshot().corrections).toBe(0);
  });

  it('Ctrl+Retroceso borra el token actual completo', () => {
    const { s } = make('int value = 42;');
    s.input('int valu');
    s.wordBackspace();
    expect(s.evaluator.pos).toBe(evaluate(s.target, 'int ').pos);
    s.wordBackspace();
    expect(s.evaluator.pos).toBe(0);
    expect(s.snapshot().doneChars).toBe(0);
  });

  it('Ctrl+Retroceso tras un espacio borra el espacio y el token anterior', () => {
    const { s } = make('int value = 42;');
    s.input('int value ');
    s.wordBackspace();
    expect(s.snapshot().doneChars).toBe(3);
  });
});

describe('sesión: indentación automática y Tab', () => {
  const opts = { compare: { mode: 'exact' as const, comments: 'omit' as const } };
  it('Enter escribe la indentación exacta y un retroceso la deshace junto con el salto', () => {
    const { s } = make('{\n    x;\n}', opts);
    s.input('{\n');
    expect(s.snapshot().doneChars).toBe(1 + 1 + 4);
    s.input('x;\n}');
    expect(s.status).toBe('finished');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('retroceso tras Enter deshace salto e indentación juntos', () => {
    const { s } = make('{\n    x;\n}', opts);
    s.input('{\n');
    s.backspace();
    expect(s.snapshot().doneChars).toBe(1);
  });

  it('sin indentación automática hay que escribirla', () => {
    const { s } = make('{\n    x;\n}', { ...opts, autoIndent: false });
    s.input('{\nx');
    expect(s.snapshot().errorsByKind.missingWhitespace).toBe(1);
  });

  it('Tab completa la indentación esperada', () => {
    const { s } = make('{\n    x;\n}', { ...opts, autoIndent: false });
    s.input('{\n');
    s.tab();
    s.input('x;\n}');
    expect(s.status).toBe('finished');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('las teclas automáticas no inflan WPM ni precisión', () => {
    const { s } = make('{\n        x;\n}', opts);
    s.input('{\n');
    const snap = s.snapshot();
    expect(snap.errorsMade).toBe(0);
    expect(s.log.filter((k) => k.auto).length).toBe(8);
  });
});

describe('sesión: pausa, inactividad y tiempo', () => {
  it('la pausa congela el tiempo y escribir la reanuda sin perder la tecla', () => {
    const { s, clock } = make('abcdef;');
    s.input('a');
    clock.advance(1000);
    s.pause();
    clock.advance(60_000);
    expect(s.snapshot().elapsedMs).toBe(1000);
    s.input('b');
    expect(s.status).toBe('running');
    expect(s.snapshot().doneChars).toBe(2);
    clock.advance(500);
    expect(s.snapshot().elapsedMs).toBe(1500);
  });

  it('Esc alterna pausa y continuación', () => {
    const { s } = make('abc;');
    s.input('a');
    s.togglePause();
    expect(s.status).toBe('paused');
    s.togglePause();
    expect(s.status).toBe('running');
  });

  it('pausa automática por inactividad excluye el tiempo inactivo', () => {
    const { s, clock } = make('abcdef;', { idleTimeoutMs: 5000 });
    s.input('a');
    clock.advance(2000);
    s.input('b');
    clock.advance(6000);
    s.tick();
    expect(s.status).toBe('paused');
    expect(s.snapshot().pauseReason).toBe('idle');
    expect(s.snapshot().elapsedMs).toBe(2000);
    clock.advance(30_000);
    s.input('c');
    clock.advance(100);
    expect(s.snapshot().elapsedMs).toBe(2100);
  });

  it('inactividad no detectada por tick se descuenta al volver a escribir', () => {
    const { s, clock } = make('abcdef;', { idleTimeoutMs: 5000 });
    s.input('a');
    clock.advance(20_000);
    s.input('b');
    expect(s.snapshot().elapsedMs).toBe(0);
  });

  it('prueba por tiempo: termina al agotarse y descarta teclas tardías', () => {
    const { s, clock } = make('abcdefghij;', { timeLimitMs: 3000 });
    typeSlowly(s, clock, 'abc', 1000);
    expect(s.input('d').ignored).toBe(1);
    expect(s.status).toBe('finished');
    expect(s.snapshot().finishReason).toBe('timeUp');
    expect(s.snapshot().elapsedMs).toBe(3000);
    expect(s.snapshot().doneChars).toBe(3);
  });

  it('prueba por tiempo: tick detecta el final aunque no se escriba', () => {
    const { s, clock } = make('abcdef;', { timeLimitMs: 2000 });
    s.input('a');
    clock.advance(2500);
    s.tick();
    expect(s.status).toBe('finished');
    expect(s.snapshot().elapsedMs).toBe(2000);
    expect(s.snapshot().remainingMs).toBe(0);
  });

  it('prueba por tiempo: al completar un texto aparece el siguiente', () => {
    const texts = ['b;', 'c;'];
    const { s } = make('a;', { timeLimitMs: 60_000, nextText: () => texts.shift() ?? 'z;' });
    s.input('a;');
    expect(s.status).toBe('running');
    expect(s.segmentIndex).toBe(1);
    expect(s.target.text).toBe('b;');
    s.input('b;c;');
    const snap = s.snapshot();
    expect(snap.textsCompleted).toBe(3);
    expect(snap.sessionCorrectChars).toBe(6);
    expect(s.backspace()).toBe(false);
  });

  it('calcula WPM con caracteres correctos / 5 por minuto', () => {
    const { s, clock } = make('abcdefghij;');
    s.input('a');
    clock.advance(60_000);
    s.input('bcdefghij');
    // 10 correct chars in 1 minute → 2 WPM
    expect(s.snapshot().wpm).toBeCloseTo(2);
    expect(s.snapshot().rawWpm).toBeCloseTo(2);
  });

  it('abortar termina la sesión conservando el tiempo', () => {
    const { s, clock } = make('abcdef;');
    s.input('ab');
    clock.advance(700);
    s.abort();
    clock.advance(10_000);
    expect(s.snapshot().finishReason).toBe('aborted');
    expect(s.snapshot().elapsedMs).toBe(700);
  });
});

describe('sesión: entrada rápida y fiabilidad', () => {
  it('una ráfaga de caracteres equivale a teclearlos uno por uno', () => {
    const a = make(CODE).s;
    const b = make(CODE).s;
    const typed = 'int main(){\n  int x =a+b;\n return x;\n}';
    a.input(typed);
    for (const ch of typed) b.input(ch);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('CR y CRLF se tratan como saltos de línea', () => {
    const { s } = make('#include <x>\nint a;');
    s.input('#include <x>\r');
    expect(s.snapshot().errorsMade).toBe(0);
  });

  it('miles de pulsaciones aleatorias con retrocesos coinciden con evaluar el texto final', () => {
    const rand = rng(42);
    const source = CODE;
    const alphabet = [...new Set(source)].concat(['x', ' ', '\n', '\t']);
    for (let run = 0; run < 60; run++) {
      const { s } = make(source, { autoIndent: false });
      let typed = '';
      for (let k = 0; k < 120; k++) {
        const r = rand();
        if (r < 0.15 && typed.length > 0) {
          s.backspace();
          typed = typed.slice(0, -1);
        } else {
          // Mostly follow the source to get deep into the text.
          const ch = r < 0.8 ? source[typed.length] ?? 'x' : pick(rand, alphabet);
          s.input(ch);
          typed += ch;
        }
        if ((s.status as string) === 'finished') break;
        const expected = evaluate(s.target, typed);
        expect(s.evaluator.pos).toBe(expected.pos);
        expect([...s.evaluator.states]).toEqual(expected.states);
        expect(s.evaluator.getCounts()).toEqual(expected.counts);
      }
    }
  });

  it('notifica a los suscriptores en cada cambio', () => {
    const { s } = make('ab;');
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.input('a');
    s.backspace();
    s.input('ab');
    off();
    s.input(';');
    expect(calls).toBe(3);
  });
});
