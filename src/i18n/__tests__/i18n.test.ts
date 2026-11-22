import { describe, expect, it } from 'vitest';
import { t, tp } from '..';

describe('i18n (es)', () => {
  it('interpola parámetros', () => {
    expect(t('lab.errorAt', { line: 3, column: 7, message: 'x' })).toBe('Línea 3, columna 7: x');
  });
  it('elige singular o plural', () => {
    expect(tp('lab.errorCount', 1)).toBe('1 error');
    expect(tp('lab.errorCount', 0)).toBe('0 errores');
    expect(tp('lab.errorCount', 2)).toBe('2 errores');
    expect(tp('lab.incomplete', 1)).toBe('Incompleto: falta 1 carácter');
    expect(tp('lab.incomplete', 12)).toBe('Incompleto: faltan 12 caracteres');
  });
});
