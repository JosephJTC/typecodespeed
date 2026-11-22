/** Keyboard actions of the typing area. Plain characters arrive through the `input` event instead. */
export type KeyAction = 'enter' | 'tab' | 'backspace' | 'wordBackspace' | 'pause' | 'restart' | 'next';

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  isComposing?: boolean;
}

export function keyAction(e: KeyLike): KeyAction | null {
  if (e.isComposing) return null;
  const mod = e.ctrlKey || e.metaKey;
  switch (e.key) {
    case 'Enter':
      if (mod && e.shiftKey) return 'next';
      if (mod) return 'restart';
      return e.altKey ? null : 'enter';
    case 'Tab':
      return mod || e.altKey ? null : 'tab';
    case 'Backspace':
      return mod || e.altKey ? 'wordBackspace' : 'backspace';
    case 'Escape':
      return 'pause';
    default:
      return null;
  }
}
