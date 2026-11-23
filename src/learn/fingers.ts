import type { Geometry, LayoutId, Stroke } from './layouts';

export type Hand = 'left' | 'right';
export type Finger = 'l-pinky' | 'l-ring' | 'l-middle' | 'l-index' | 'l-thumb' | 'r-thumb' | 'r-index' | 'r-middle' | 'r-ring' | 'r-pinky';
export const FINGERS: Finger[] = ['l-pinky', 'l-ring', 'l-middle', 'l-index', 'l-thumb', 'r-thumb', 'r-index', 'r-middle', 'r-ring', 'r-pinky'];

export const handOf = (f: Finger): Hand => (f.startsWith('l-') ? 'left' : 'right');

/** User preferences that change the standard assignment. */
export interface FingerPrefs {
  /** Thumb used for the space bar. */
  spaceThumb: Hand;
}

const group = (finger: Finger, codes: string): Array<[string, Finger]> => codes.split(' ').map((c) => [c, finger]);

/** Standard touch-typing assignment by key position (columns of the alphanumeric block). */
const STANDARD: Readonly<Record<string, Finger>> = Object.fromEntries([
  ...group('l-pinky', 'Backquote Escape Digit1 KeyQ KeyA KeyZ Tab CapsLock ShiftLeft ControlLeft'),
  ...group('l-ring', 'Digit2 KeyW KeyS KeyX'),
  ...group('l-middle', 'Digit3 KeyE KeyD KeyC'),
  ...group('l-index', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB'),
  ...group('l-thumb', 'AltLeft'),
  ...group('r-thumb', 'AltRight'),
  ...group('r-index', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM'),
  ...group('r-middle', 'Digit8 KeyI KeyK Comma'),
  ...group('r-ring', 'Digit9 KeyO KeyL Period'),
  ...group('r-pinky', 'Digit0 Minus Equal KeyP BracketLeft BracketRight Semicolon Quote Slash Enter ShiftRight Backspace'),
]);

/** Keys whose position, and so their finger, depends on the shape of the board. */
const BY_GEOMETRY: Readonly<Record<Geometry, Readonly<Record<string, Finger>>>> = {
  // ANSI: the key above Enter.
  ansi: { Backslash: 'r-pinky' },
  // ISO: an extra key next to the left Shift, and the key left of Enter on the home row.
  iso: { IntlBackslash: 'l-pinky', Backslash: 'r-pinky' },
};

/** Per-layout exceptions to the standard assignment; none of the bundled layouts needs one yet. */
const BY_LAYOUT: Partial<Record<LayoutId, Readonly<Record<string, Finger>>>> = {};

/** Finger recommended for every key of a keyboard; keys without one (function keys, arrows, numpad) are absent. */
export function fingerMap(layout: LayoutId, geometry: Geometry, prefs: FingerPrefs): Map<string, Finger> {
  const map = new Map<string, Finger>(Object.entries({ ...STANDARD, ...BY_GEOMETRY[geometry], ...BY_LAYOUT[layout] }));
  map.set('Space', prefs.spaceThumb === 'left' ? 'l-thumb' : 'r-thumb');
  return map;
}

/** A key to press with the finger recommended for it. */
export interface Press {
  code: string;
  finger: Finger | undefined;
}

/**
 * Expands a stroke into the keys to hold: the key itself plus the modifier,
 * using the Shift of the opposite hand, as touch typing teaches.
 */
export function pressesFor(stroke: Stroke, fingers: ReadonlyMap<string, Finger>): Press[] {
  const finger = fingers.get(stroke.code);
  const out: Press[] = [];
  if (stroke.shift) {
    const code = finger && handOf(finger) === 'left' ? 'ShiftRight' : 'ShiftLeft';
    out.push({ code, finger: fingers.get(code) });
  }
  if (stroke.altgr) out.push({ code: 'AltRight', finger: fingers.get('AltRight') });
  out.push({ code: stroke.code, finger });
  return out;
}
