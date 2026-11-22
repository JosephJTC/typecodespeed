import type { Motion } from '../../editor';

/** Keyboard actions of the typing area. Plain characters arrive through the `input` event instead. */
export type KeyAction =
  | 'enter'
  | 'tab'
  | 'backspace'
  | 'wordBackspace'
  | 'delete'
  | 'wordDelete'
  | 'selectAll'
  | 'pause'
  | 'restart'
  | 'next'
  | { move: Motion };

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
    case 'Delete':
      return mod || e.altKey ? 'wordDelete' : 'delete';
    case 'ArrowLeft':
      return { move: mod || e.altKey ? 'wordLeft' : 'left' };
    case 'ArrowRight':
      return { move: mod || e.altKey ? 'wordRight' : 'right' };
    case 'ArrowUp':
      return { move: 'up' };
    case 'ArrowDown':
      return { move: 'down' };
    case 'Home':
      return { move: mod ? 'docStart' : 'home' };
    case 'End':
      return { move: mod ? 'docEnd' : 'end' };
    case 'a':
    case 'A':
      return mod && !e.altKey ? 'selectAll' : null;
    case 'Escape':
      return 'pause';
    default:
      return null;
  }
}
