import { describe, expect, it } from 'vitest';
import { scrollDelta } from '../scroll';

describe('desplazamiento automático del código', () => {
  it('no se mueve si el cursor está en la zona central', () => {
    expect(scrollDelta(0, 600, 280, 300, 200)).toBe(0);
  });

  it('baja antes de que el cursor llegue al borde inferior, dejando visibles las líneas siguientes', () => {
    expect(scrollDelta(0, 600, 420, 444, 200)).toBe(44);
    expect(scrollDelta(0, 600, 580, 604, 200)).toBe(204);
  });

  it('sube al volver a líneas anteriores', () => {
    expect(scrollDelta(0, 600, 100, 124, 200)).toBe(-100);
  });

  it('en vistas muy bajas reduce el margen para no oscilar', () => {
    expect(scrollDelta(0, 40, 10, 30, 200)).toBe(0);
  });
});
