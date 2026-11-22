import { describe, expect, it } from 'vitest';
import { keyAction, type KeyLike } from '../keyboard';

const k = (key: string, mods: Partial<KeyLike> = {}): KeyLike => ({ key, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });

describe('atajos de teclado', () => {
  it('teclas de control', () => {
    expect(keyAction(k('Enter'))).toBe('enter');
    expect(keyAction(k('Tab'))).toBe('tab');
    expect(keyAction(k('Backspace'))).toBe('backspace');
    expect(keyAction(k('Escape'))).toBe('pause');
  });
  it('combinaciones', () => {
    expect(keyAction(k('Backspace', { ctrlKey: true }))).toBe('wordBackspace');
    expect(keyAction(k('Backspace', { altKey: true }))).toBe('wordBackspace');
    expect(keyAction(k('Enter', { ctrlKey: true }))).toBe('restart');
    expect(keyAction(k('Enter', { metaKey: true, shiftKey: true }))).toBe('next');
  });
  it('los caracteres imprimibles y la composición (IME) no son acciones', () => {
    expect(keyAction(k('a'))).toBeNull();
    expect(keyAction(k('{'))).toBeNull();
    expect(keyAction(k(' '))).toBeNull();
    expect(keyAction(k('Enter', { isComposing: true }))).toBeNull();
  });
});
