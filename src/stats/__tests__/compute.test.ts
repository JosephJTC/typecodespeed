import { describe, expect, it } from 'vitest';
import { pick, rng } from '../../lib/random';
import { bucketSizeFor, buildBuckets, charClassOf, consistencyOf, hashText, isCorrectKey, isErrorKey, timeline } from '../compute';
import { makeSession, play, quickRecord, recordOf } from './fixtures';

describe('registro de una prueba', () => {
  it('prueba perfecta: velocidad, precisión y avance exactos', () => {
    // 6 teclas, una cada 200 ms; el reloj arranca con la primera → 1000 ms activos.
    const r = quickRecord('a+b;c;', 'a+b;c;');
    expect(r.finishReason).toBe('completed');
    expect(r.durationMs).toBe(1000);
    expect(r.correctChars).toBe(6);
    expect(r.keystrokes).toBe(6);
    expect(r.cps).toBeCloseTo(6);
    expect(r.wpm).toBeCloseTo(72); // 6 / 5 palabras en 1/60 min
    expect(r.rawWpm).toBeCloseTo(72);
    expect(r.accuracy).toBe(1);
    expect(r.completion).toBe(1);
    expect(r.errorsMade).toBe(0);
    expect(r.confusions).toEqual([]);
    expect(r.tokensCorrect).toBe(r.tokensTotal);
  });

  it('errores corregidos bajan la precisión pero no quedan pendientes', () => {
    const r = quickRecord('abc;', 'ax<bc;');
    expect(r.errorsMade).toBe(1);
    expect(r.uncorrected).toBe(0);
    expect(r.corrections).toBe(1);
    expect(r.keystrokes).toBe(5);
    expect(r.evaluated).toBe(5);
    expect(r.accuracy).toBeCloseTo(4 / 5);
    expect(r.errorsByKind).toEqual({ substitution: 1 });
    expect(r.confusions).toEqual([{ expected: 'b', typed: 'x', count: 1 }]);
    expect(r.chars.b).toMatchObject({ attempts: 2, errors: 1 });
    expect(r.chars.a).toMatchObject({ attempts: 1, errors: 0 });
    expect(r.chars.x).toBeUndefined();
  });

  it('prueba abandonada: el avance refleja lo escrito', () => {
    const r = quickRecord('abcdefgh;', 'abc');
    expect(r.finishReason).toBe('aborted');
    expect(r.completion).toBeCloseTo(3 / 9);
  });

  it('modo bloquear: las teclas rechazadas cuentan como error pero no como pulsación aceptada', () => {
    const r = quickRecord('int x;', 'inxt x;', { config: { errorPolicy: 'block' } });
    expect(r.finishReason).toBe('completed');
    expect(r.errorsMade).toBe(1);
    expect(r.keystrokes).toBe(6);
    expect(r.evaluated).toBe(7);
    expect(r.accuracy).toBeCloseTo(6 / 7);
    expect(r.chars.t).toMatchObject({ attempts: 2, errors: 1 });
    expect(r.confusions).toEqual([{ expected: 't', typed: 'x', count: 1 }]);
  });

  it('separador faltante: se clasifica por tipo y como espacio en blanco', () => {
    const r = quickRecord('int x;', 'intx');
    expect(r.errorsByKind.missingSeparator).toBe(1);
    expect(r.tokenTypes.whitespace).toMatchObject({ attempts: 1, errors: 1 });
    expect(r.charClasses.whitespace).toMatchObject({ attempts: 1, errors: 1 });
  });

  it('métricas por tipo de token y clase de carácter', () => {
    const r = quickRecord('int x1 = 42;', 'int x1 = 4z;');
    expect(r.tokenTypes.keyword).toMatchObject({ attempts: 3, errors: 0 });
    expect(r.tokenTypes.identifier).toMatchObject({ attempts: 2, errors: 0 });
    expect(r.tokenTypes.number).toMatchObject({ attempts: 2, errors: 1 });
    expect(r.charClasses.digit).toMatchObject({ attempts: 3, errors: 1 });
    expect(r.charClasses.letter).toMatchObject({ attempts: 4, errors: 0 });
    expect(r.charClasses.symbol).toMatchObject({ attempts: 2, errors: 0 });
    // Los tres espacios opcionales son teclas correctas, sin carácter esperado.
    expect(r.tokenTypes.whitespace).toMatchObject({ attempts: 3, errors: 0 });
  });

  it('mide la demora antes de cada tecla y descarta pausas largas', () => {
    const { s, clock } = makeSession('ab;ab;');
    s.input('a');
    clock.advance(100);
    s.input('b');
    clock.advance(300);
    s.input(';');
    clock.advance(9000); // titubeo: no cuenta como ritmo
    s.input('a');
    clock.advance(500);
    s.input('b');
    const r = recordOf(s);
    expect(r.chars.a).toMatchObject({ attempts: 2, timed: 0 });
    expect(r.chars.b).toMatchObject({ attempts: 2, timed: 2, timeMs: 600 });
    expect(r.chars[';']).toMatchObject({ attempts: 1, timed: 1, timeMs: 300 });
  });

  it('la indentación automática no cuenta como teclas del usuario', () => {
    const r = quickRecord('{\n    x;\n}', '{\nx;\n}', { config: { compare: { mode: 'exact', comments: 'omit' } } });
    expect(r.finishReason).toBe('completed');
    expect(r.keystrokes).toBe(6);
    expect(r.chars[' ']).toBeUndefined();
    expect(r.buckets.reduce((a, b) => a + b.typed, 0)).toBe(6);
  });

  it('prueba por tiempo: acumula varios textos y el avance es la fracción del tiempo', () => {
    const texts = ['c;', 'd;'];
    const { s, clock } = makeSession('a;', { timeLimitMs: 2000, nextText: () => texts.shift() ?? 'z;' });
    play(s, clock, 'a;c;d', 250);
    const aborted = recordOf(s, { testType: 'timed', timeLimitMs: 2000 });
    expect(aborted.durationMs).toBe(1000);
    expect(aborted.completion).toBeCloseTo(0.5);
    expect(aborted.textsCompleted).toBe(2);
    expect(aborted.correctChars).toBe(5);
    expect(aborted.textHash).toBe(hashText('a;\u0000c;\u0000d;'));
  });

  it('el identificador de texto distingue códigos distintos', () => {
    expect(quickRecord('a;', 'a;').textHash).toBe(quickRecord('a;', 'a').textHash);
    expect(quickRecord('a;', 'a;').textHash).not.toBe(quickRecord('b;', 'b;').textHash);
  });
});

describe('línea de tiempo', () => {
  it('el tamaño del intervalo mantiene como máximo 60 puntos', () => {
    expect(bucketSizeFor(900)).toBe(1000);
    expect(bucketSizeFor(60_000)).toBe(1000);
    expect(bucketSizeFor(60_001)).toBe(2000);
    expect(bucketSizeFor(600_000)).toBe(10_000);
  });

  it('reparte las teclas en intervalos y el último puede ser parcial', () => {
    // Teclas en t = 0, 400, 800, 1200, 1600, 2000, 2400 ms; termina en 2400 ms.
    const r = quickRecord('abcdef;', 'abxdef;', { ms: 400 });
    expect(r.durationMs).toBe(2400);
    expect(r.bucketMs).toBe(1000);
    expect(r.buckets.map((b) => [b.t, b.ms, b.correct, b.errors, b.typed])).toEqual([
      [0, 1000, 2, 1, 3],
      [1000, 1000, 2, 0, 2],
      [2000, 400, 2, 0, 2],
    ]);
    const points = timeline(r);
    expect(points.map((p) => p.t)).toEqual([0.5, 1.5, 2.2]);
    expect(points[0].cps).toBeCloseTo(2);
    expect(points[0].wpm).toBeCloseTo(24);
    expect(points[0].rawWpm).toBeCloseTo(36);
    expect(points[0].accuracy).toBeCloseTo(2 / 3);
    expect(points[1].accuracy).toBe(1);
    expect(points[2].cps).toBeCloseTo(5);
    expect(points[2].cumulativeAccuracy).toBeCloseTo(6 / 7);
    expect(points[2].cumulativeWpm).toBeCloseTo(6 / 5 / (2.4 / 60));
  });

  it('un intervalo sin teclas no tiene precisión propia', () => {
    const { s, clock } = makeSession('ab;');
    s.input('a');
    clock.advance(2500);
    s.input('b');
    clock.advance(100);
    const points = timeline(recordOf(s));
    expect(points[1].accuracy).toBeNull();
    expect(points[1].cps).toBe(0);
    expect(points[1].cumulativeAccuracy).toBe(1);
  });

  it('las pausas no aparecen en la línea de tiempo', () => {
    const { s, clock } = makeSession('abcd;');
    s.input('a');
    clock.advance(500);
    s.pause();
    clock.advance(60_000);
    s.input('b');
    clock.advance(500);
    const r = recordOf(s);
    expect(r.durationMs).toBe(1000);
    expect(r.buckets).toHaveLength(1);
    expect(r.buckets[0].correct).toBe(2);
  });

  it('los totales de la línea de tiempo coinciden con el registro en sesiones aleatorias', () => {
    const rand = rng(7);
    const source = 'for (int i = 0; i < n; i++) {\n    sum += a[i] * 2;\n}';
    const alphabet = [...new Set(source)].concat(['x', 'Q', ' ', '\n']);
    for (let run = 0; run < 40; run++) {
      const policy = run % 2 ? 'block' : 'advance';
      const { s, clock } = makeSession(source, { errorPolicy: policy, autoIndent: run % 3 === 0 });
      let typed = 0;
      for (let k = 0; k < 150 && s.status !== 'finished'; k++) {
        clock.advance(Math.floor(rand() * 400));
        const r = rand();
        if (r < 0.12) s.backspace();
        else {
          const ch = r < 0.8 ? source[typed] ?? 'x' : pick(rand, alphabet);
          if (s.input(ch).accepted) typed++;
        }
      }
      const rec = recordOf(s, { errorPolicy: policy });
      const snap = s.snapshot();
      const sum = (f: (b: (typeof rec.buckets)[number]) => number) => rec.buckets.reduce((a, b) => a + f(b), 0);
      const manual = s.log.filter((k) => !k.auto && k.kind === 'char');
      expect(sum((b) => b.errors)).toBe(snap.errorsMade);
      expect(sum((b) => b.errors)).toBe(manual.filter(isErrorKey).length);
      expect(sum((b) => b.correct)).toBe(manual.filter(isCorrectKey).length);
      expect(sum((b) => b.typed)).toBe(rec.keystrokes);
      expect(sum((b) => b.corrections)).toBe(snap.corrections);
      expect(sum((b) => b.ms)).toBe(Math.max(rec.durationMs, rec.durationMs === 0 ? rec.bucketMs : 0));
      expect(rec.evaluated).toBe(sum((b) => b.correct + b.errors));
      expect(rec.accuracy).toBeCloseTo(rec.evaluated ? sum((b) => b.correct) / rec.evaluated : 1);
      const errorsByKind = Object.values(rec.errorsByKind).reduce((a, n) => a + (n ?? 0), 0);
      expect(errorsByKind).toBe(rec.errorsMade);
      const charErrors = Object.values(rec.chars).reduce((a, c) => a + c.errors, 0);
      expect(charErrors).toBe(rec.errorsByKind.substitution ?? 0);
      const last = timeline(rec).at(-1)!;
      expect(last.cumulativeAccuracy).toBeCloseTo(rec.accuracy);
    }
  });

  it('buildBuckets ubica una tecla en el límite final dentro del último intervalo', () => {
    const b = buildBuckets([{ t: 2000, kind: 'char', ch: 'a', status: 'correct', segment: 0 }], 2000);
    expect(b).toHaveLength(2);
    expect(b[1].correct).toBe(1);
  });
});

describe('consistencia y clases', () => {
  const bucket = (correct: number, ms = 1000) => ({ t: 0, ms, correct, errors: 0, typed: correct, corrections: 0 });
  it('ritmo constante = 1; ritmo irregular baja', () => {
    expect(consistencyOf([bucket(5), bucket(5), bucket(5)])).toBe(1);
    expect(consistencyOf([bucket(2), bucket(8)])).toBeCloseTo(1 - 3 / 5);
    expect(consistencyOf([bucket(0), bucket(0)])).toBe(0);
    expect(consistencyOf([bucket(5)])).toBe(1);
  });
  it('ignora un último intervalo demasiado corto', () => {
    expect(consistencyOf([bucket(5), bucket(5), bucket(1, 100)])).toBe(1);
  });
  it('clasifica caracteres', () => {
    expect(['a', '_', 'Z', 'ñ'].map(charClassOf)).toEqual(['letter', 'letter', 'letter', 'letter']);
    expect(['0', '9'].map(charClassOf)).toEqual(['digit', 'digit']);
    expect(['{', '<', ';', '#', '"'].map(charClassOf)).toEqual(['symbol', 'symbol', 'symbol', 'symbol', 'symbol']);
    expect([' ', '\n', '\t'].map(charClassOf)).toEqual(['whitespace', 'whitespace', 'whitespace']);
  });
});
