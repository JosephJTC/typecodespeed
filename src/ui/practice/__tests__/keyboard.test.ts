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
  it('navegación y edición', () => {
    expect(keyAction(k('ArrowLeft'))).toEqual({ move: 'left' });
    expect(keyAction(k('ArrowRight'))).toEqual({ move: 'right' });
    expect(keyAction(k('ArrowUp'))).toEqual({ move: 'up' });
    expect(keyAction(k('ArrowDown'))).toEqual({ move: 'down' });
    expect(keyAction(k('ArrowLeft', { ctrlKey: true }))).toEqual({ move: 'wordLeft' });
    expect(keyAction(k('ArrowRight', { altKey: true }))).toEqual({ move: 'wordRight' });
    expect(keyAction(k('Home'))).toEqual({ move: 'home' });
    expect(keyAction(k('End'))).toEqual({ move: 'end' });
    expect(keyAction(k('Home', { ctrlKey: true }))).toEqual({ move: 'docStart' });
    expect(keyAction(k('End', { ctrlKey: true }))).toEqual({ move: 'docEnd' });
    expect(keyAction(k('Delete'))).toBe('delete');
    expect(keyAction(k('Delete', { ctrlKey: true }))).toBe('wordDelete');
    expect(keyAction(k('a', { ctrlKey: true }))).toBe('selectAll');
    expect(keyAction(k('a', { ctrlKey: true, altKey: true }))).toBeNull();
  });
  it('los caracteres imprimibles y la composición (IME) no son acciones', () => {
    expect(keyAction(k('a'))).toBeNull();
    expect(keyAction(k('{'))).toBeNull();
    expect(keyAction(k(' '))).toBeNull();
    expect(keyAction(k('Enter', { isComposing: true }))).toBeNull();
  });
});
