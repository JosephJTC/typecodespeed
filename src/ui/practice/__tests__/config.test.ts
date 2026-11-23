import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, metaFor, parseSettings, sessionConfig } from '../config';

const SOURCE = { id: 'x', name: 'x', language: 'cpp', codes: ['f();'] };

describe('ajuste sin guía', () => {
  it('viene desactivado y se restaura al recargar', () => {
    expect(DEFAULT_SETTINGS.hideGuide).toBe(false);
    expect(parseSettings(JSON.stringify({ hideGuide: true })).hideGuide).toBe(true);
    expect(parseSettings(JSON.stringify({ hideGuide: 'sí' })).hideGuide).toBe(false);
  });

  it('pasa a la sesión y queda marcado en el resultado solo cuando está activo', () => {
    const on = { ...DEFAULT_SETTINGS, hideGuide: true };
    expect(sessionConfig(on, 'cpp').hideGuide).toBe(true);
    expect(metaFor(on, SOURCE).hideGuide).toBe(true);
    expect('hideGuide' in metaFor(DEFAULT_SETTINGS, SOURCE)).toBe(false);
  });
});
