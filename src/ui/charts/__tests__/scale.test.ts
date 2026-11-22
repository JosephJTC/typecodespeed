import { describe, expect, it } from 'vitest';
import { linePath, niceTicks } from '../scale';

describe('escalas de las gráficas', () => {
  it('genera marcas redondas que cubren el rango', () => {
    expect(niceTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(0, 87)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0, 7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(3, 3).length).toBeGreaterThan(1);
    expect(niceTicks(0, 0)).toEqual([0, 1]);
  });

  it('las marcas siempre contienen los extremos', () => {
    for (const [a, b] of [[0, 3.7], [12, 961], [0.31, 0.99], [5, 6], [0, 0.004]]) {
      const t = niceTicks(a, b);
      expect(t[0]).toBeLessThanOrEqual(a);
      expect(t[t.length - 1]).toBeGreaterThanOrEqual(b);
      expect(t.length).toBeLessThanOrEqual(12);
    }
  });

  it('la línea se corta donde no hay dato', () => {
    const id = (v: number) => v;
    expect(linePath([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: null }, { x: 3, y: 4 }], id, id)).toBe('M0.0,1.0L1.0,2.0M3.0,4.0');
    expect(linePath([], id, id)).toBe('');
  });
});
