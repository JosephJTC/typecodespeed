import { describe, expect, it } from 'vitest';
import { closesBefore, inLiteral } from '../pairs';

const at = (src: string) => inLiteral(src.replace('|', ''), src.indexOf('|'));

describe('inLiteral', () => {
  it.each([
    ['f(|', false],
    ['"abc|', true],
    ['"a\\"b|', true],
    ['"a" + |', false],
    ["'|", true],
    ["'\\''|", false],
    ["'a' |", false],
    ['// comentario |', true],
    ['// c\nf(|', false],
    ['/* bloque |', true],
    ['/* a */ |', false],
    ['x = 1\'000\'000 + |', false],
    ['a / |', false],
    ['"multi\n|', false],
  ])('%j → %s', (src, expected) => {
    expect(at(src)).toBe(expected);
  });
});

describe('closesBefore', () => {
  it('cierra al final, antes de espacios, separadores o cierres', () => {
    for (const next of [undefined, ' ', '\n', ';', ',', ')', ']', '}']) expect(closesBefore(next)).toBe(true);
  });
  it('no cierra antes de identificadores o números', () => {
    for (const next of ['a', '_', '1', '(']) expect(closesBefore(next)).toBe(false);
  });
});
