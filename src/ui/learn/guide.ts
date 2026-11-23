import { t } from '../../i18n';
import { pressesFor, type Press, type Stroke } from '../../learn';
import type { Keyboard } from './useKeyboard';

/** The keys to press for a stroke, with their recommended fingers. */
export function guidePresses(keyboard: Keyboard, stroke: Stroke | undefined): Press[] {
  return stroke ? pressesFor(stroke, keyboard.fingers) : [];
}

/** Name of the finger recommended for the main key of the presses. */
export function fingerName(presses: readonly Press[]): string {
  const finger = presses.at(-1)?.finger;
  return finger ? t(`learn.fingers.${finger}`) : '';
}
