import { describe, expect, it } from 'vitest';
import { averageMetrics, comparableTo, compareRecords, insights, progress, rankDifficulty, summarize, trend } from '../analysis';
import type { KeyStat, TestRecord } from '../types';
import { quickRecord } from './fixtures';

const stat = (attempts: number, errors: number, avgMs = 200): KeyStat => ({ attempts, errors, timeMs: avgMs * attempts, timed: attempts });

/** Minimal record with the given overrides, for aggregate tests. */
function rec(overrides: Partial<TestRecord>): TestRecord {
  return { ...quickRecord('a;', 'a;'), ...overrides };
}

describe('caracteres difíciles', () => {
  it('ordena por tasa de error y descarta muestras pequeñas', () => {
    const ranked = rankDifficulty({ '{': stat(10, 4), a: stat(50, 1), ';': stat(20, 4), q: stat(2, 2) });
    expect(ranked.map((r) => r.key)).toEqual(['{', ';', 'a']);
    expect(ranked[0].errorRate).toBeCloseTo(0.4);
  });

  it('la lentitud se mide contra el promedio propio y desempata', () => {
    const ranked = rankDifficulty({ a: stat(10, 0, 100), '&': stat(10, 0, 500), b: stat(10, 0, 100) });
    expect(ranked[0].key).toBe('&');
    // promedio global = (1000 + 5000 + 1000) / 30
    expect(ranked[0].slowness).toBeCloseTo(500 / (7000 / 30));
    expect(ranked[0].avgMs).toBe(500);
  });
});

describe('resumen de varias pruebas', () => {
  const fast = quickRecord('abcdefghij;', 'abcdefghij;', { ms: 100, id: 'fast', finishedAt: 2 });
  const slow = quickRecord('ab;', 'ax<b;', { ms: 1000, id: 'slow', finishedAt: 1 });

  it('pondera la velocidad por tiempo y la precisión por teclas evaluadas', () => {
    const s = summarize([fast, slow]);
    expect(s.tests).toBe(2);
    expect(s.totalTimeMs).toBe(1000 + 4000);
    expect(s.totalChars).toBe(11 + 3);
    expect(s.avgWpm).toBeCloseTo(14 / 5 / (5000 / 60000));
    expect(s.avgCps).toBeCloseTo(14 / 5);
    expect(s.avgAccuracy).toBeCloseTo((11 + 3) / (11 + 4));
    expect(s.bestWpm).toBeCloseTo(fast.wpm);
    expect(s.errorsByKind).toEqual({ substitution: 1 });
    expect(s.chars.b).toMatchObject({ attempts: 3, errors: 1 });
    expect(s.confusions).toEqual([{ expected: 'b', typed: 'x', count: 1 }]);
  });

  it('sin pruebas devuelve ceros', () => {
    const s = summarize([]);
    expect(s).toMatchObject({ tests: 0, avgWpm: 0, bestWpm: 0, avgAccuracy: 0, totalTimeMs: 0 });
  });
});

describe('comparaciones', () => {
  it('indica qué métricas mejoran según su sentido', () => {
    const a = rec({ wpm: 40, accuracy: 0.9, errorsMade: 10, durationMs: 1000 });
    const b = rec({ wpm: 50, accuracy: 0.85, errorsMade: 4, durationMs: 2000 });
    const c = compareRecords(a, b);
    expect(c.wpm).toMatchObject({ a: 40, b: 50, delta: 10, better: true });
    expect(c.accuracy.better).toBe(false);
    expect(c.errorsMade).toMatchObject({ delta: -6, better: true });
    expect(c.durationMs.better).toBeNull();
    expect(c.corrections.better).toBeNull();
  });

  it('promedia métricas de un grupo', () => {
    expect(averageMetrics([])).toBeNull();
    expect(averageMetrics([rec({ wpm: 40 }), rec({ wpm: 60 })])!.wpm).toBe(50);
  });

  it('solo compara contra pruebas anteriores del mismo tipo y modo', () => {
    const base = rec({ id: 'x', finishedAt: 10, testType: 'timed', timeLimitMs: 60000 });
    const all = [
      base,
      rec({ id: 'same', finishedAt: 5, testType: 'timed', timeLimitMs: 60000 }),
      rec({ id: 'later', finishedAt: 20, testType: 'timed', timeLimitMs: 60000 }),
      rec({ id: 'otherLimit', finishedAt: 5, testType: 'timed', timeLimitMs: 30000 }),
      rec({ id: 'otherType', finishedAt: 5, testType: 'full' }),
      rec({ id: 'otherMode', finishedAt: 5, testType: 'timed', timeLimitMs: 60000, mode: 'exact' }),
    ];
    expect(comparableTo(base, all).map((r) => r.id)).toEqual(['same']);
  });
});

describe('progreso y tendencia', () => {
  const series = [30, 32, 31, 35, 40, 42, 41, 45].map((wpm, i) => rec({ id: `t${i}`, finishedAt: 100 - i === 0 ? 0 : i + 1, wpm, accuracy: 0.9 + i * 0.01 }));

  it('ordena cronológicamente y calcula la media móvil', () => {
    const p = progress([...series].reverse(), 3);
    expect(p.map((x) => x.wpm)).toEqual([30, 32, 31, 35, 40, 42, 41, 45]);
    expect(p.map((x) => x.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(p[0].wpmAvg).toBe(30);
    expect(p[1].wpmAvg).toBe(31);
    expect(p[4].wpmAvg).toBeCloseTo((31 + 35 + 40) / 3);
  });

  it('compara las últimas pruebas contra las anteriores', () => {
    const t = trend(series, 'wpm', 4)!;
    expect(t.previous).toBeCloseTo(32);
    expect(t.recent).toBeCloseTo(42);
    expect(t.delta).toBeCloseTo(10);
    expect(trend(series.slice(0, 1), 'wpm')).toBeNull();
    // Con 3 pruebas compara 1 contra 1.
    expect(trend(series.slice(0, 3), 'wpm')!.delta).toBeCloseTo(-1);
  });
});

describe('observaciones', () => {
  it('sin historial no hay observaciones', () => {
    expect(insights([])).toEqual([]);
  });

  it('una prueba limpia no genera debilidades', () => {
    const clean = quickRecord('int main() { return 0; }', 'int main() { return 0; }');
    expect(insights([clean])).toEqual([]);
  });

  it('detecta carácter difícil, confusión frecuente y precisión baja', () => {
    const r = rec({
      accuracy: 0.8,
      evaluated: 100,
      chars: { '{': stat(10, 5), a: stat(60, 0) },
      confusions: [{ expected: '{', typed: '[', count: 5 }],
      errorsByKind: { substitution: 5 },
    });
    const out = insights([r]);
    expect(out).toContainEqual({ kind: 'lowAccuracy', accuracy: 0.8 });
    expect(out).toContainEqual({ kind: 'difficultChar', char: '{', errorRate: 0.5, attempts: 10 });
    expect(out).toContainEqual({ kind: 'confusion', expected: '{', typed: '[', count: 5 });
  });

  it('detecta un tipo de error dominante distinto de la sustitución', () => {
    const r = rec({ errorsByKind: { missingSeparator: 6, substitution: 2 } });
    expect(insights([r])).toContainEqual({ kind: 'errorKind', error: 'missingSeparator', share: 0.75, count: 6 });
  });

  it('detecta caracteres lentos sin errores', () => {
    const r = rec({ chars: { a: stat(40, 0, 100), '&': stat(10, 0, 400) } });
    const slow = insights([r]).find((i) => i.kind === 'slowChar');
    expect(slow).toMatchObject({ char: '&', avgMs: 400 });
  });

  it('detecta tendencia con suficiente historial', () => {
    const up = [30, 30, 30, 40, 40, 40].map((wpm, i) => rec({ id: `u${i}`, finishedAt: i, wpm }));
    expect(insights(up)).toContainEqual({ kind: 'trend', metric: 'wpm', delta: 10 });
    expect(insights(up.slice(0, 4)).some((i) => i.kind === 'trend')).toBe(false);
  });

  it('detecta exceso de correcciones', () => {
    const r = rec({ keystrokes: 200, corrections: 30 });
    expect(insights([r])).toContainEqual({ kind: 'manyCorrections', perHundred: 15 });
  });
});
