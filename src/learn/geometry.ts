import type { Geometry } from './layouts';

/** Keyboard sizes, by the blocks of keys they have. */
export type SizeId = 'full' | 'tkl' | '75' | '65' | '60' | 'laptop';
export const SIZE_IDS: SizeId[] = ['full', 'tkl', '75', '65', '60', 'laptop'];

/** A key placed on the board; units are key widths (1 = a letter key). */
export interface PlacedKey {
  code: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** ISO Enter: an inverted L spanning two rows. */
  isoEnter?: boolean;
}

export interface Board {
  keys: PlacedKey[];
  width: number;
  height: number;
}

type Spec = string | [code: string, w: number] | number;

/** Lays keys left to right; a number is a gap. */
function row(y: number, specs: Spec[], x = 0, h = 1): PlacedKey[] {
  const out: PlacedKey[] = [];
  for (const s of specs) {
    if (typeof s === 'number') {
      x += s;
      continue;
    }
    const [code, w] = typeof s === 'string' ? [s, 1] : s;
    out.push({ code, x, y, w, h });
    x += w;
  }
  return out;
}

const keys = (prefix: string, names: string) => names.split(' ').map((n) => prefix + n);
const NUMBERS = [...keys('Digit', '1 2 3 4 5 6 7 8 9 0'), 'Minus', 'Equal'];
const TOP = [...keys('Key', 'Q W E R T Y U I O P'), 'BracketLeft', 'BracketRight'];
const HOME = [...keys('Key', 'A S D F G H J K L'), 'Semicolon', 'Quote'];
const BOTTOM = [...keys('Key', 'Z X C V B N M'), 'Comma', 'Period', 'Slash'];
const F_KEYS = keys('F', '1 2 3 4 5 6 7 8 9 10 11 12');

/** The four letter rows, 15 units wide, in the given shape. `rightShift` is the width of the right Shift. */
function alpha(geometry: Geometry, y: number, first: string, rightShift = 2.75): PlacedKey[] {
  const isoEnter = geometry === 'iso';
  const extraKey = geometry !== 'ansi';
  return [
    ...row(y, [first, ...NUMBERS, ['Backspace', 2]]),
    ...row(y + 1, [['Tab', 1.5], ...TOP, ...(isoEnter ? [] : [['Backslash', 1.5] as Spec])]),
    ...row(y + 2, [['CapsLock', 1.75], ...HOME, ...(isoEnter ? ['Backslash'] : [['Enter', 2.25] as Spec])]),
    ...(isoEnter ? [{ code: 'Enter', x: 13.5, y: y + 1, w: 1.5, h: 2, isoEnter: true }] : []),
    ...row(y + 3, [...(extraKey ? [['ShiftLeft', 1.25] as Spec, 'IntlBackslash'] : [['ShiftLeft', 2.25] as Spec]), ...BOTTOM, ['ShiftRight', rightShift]]),
  ];
}

const MODS_LEFT: Spec[] = [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25]];
const FULL_BOTTOM: Spec[] = [...MODS_LEFT, ['Space', 6.25], ['AltRight', 1.25], ['MetaRight', 1.25], ['ContextMenu', 1.25], ['ControlRight', 1.25]];
const ARROWS_BOTTOM: Spec[] = [...MODS_LEFT, ['Space', 6.25], 'AltRight', 'Fn', 'ControlRight', 'ArrowLeft', 'ArrowDown', 'ArrowRight'];

/** Function row with the usual gaps of full-size and TKL boards, plus the navigation cluster. */
function functionAndNav(): PlacedKey[] {
  return [
    ...row(0, ['Escape', 1, ...F_KEYS.slice(0, 4), 0.5, ...F_KEYS.slice(4, 8), 0.5, ...F_KEYS.slice(8), 0.25, 'PrintScreen', 'ScrollLock', 'Pause']),
    ...row(1.5, ['Insert', 'Home', 'PageUp'], 15.25),
    ...row(2.5, ['Delete', 'End', 'PageDown'], 15.25),
    ...row(4.5, ['ArrowUp'], 16.25),
    ...row(5.5, ['ArrowLeft', 'ArrowDown', 'ArrowRight'], 15.25),
  ];
}

const BUILDERS: Record<SizeId, (g: Geometry) => PlacedKey[]> = {
  '60': (g) => [...alpha(g, 0, 'Escape'), ...row(4, FULL_BOTTOM)],
  '65': (g) => [
    ...alpha(g, 0, 'Escape', 1.75),
    ...row(0, ['Delete'], 15),
    ...row(1, ['PageUp'], 15),
    ...row(2, ['PageDown'], 15),
    ...row(3, ['ArrowUp', 'End'], 14),
    ...row(4, ARROWS_BOTTOM),
  ],
  '75': (g) => [
    ...row(0, ['Escape', ...F_KEYS, 'PrintScreen', 'Pause', 'Delete']),
    ...alpha(g, 1, 'Backquote', 1.75),
    ...row(1, ['Home'], 15),
    ...row(2, ['PageUp'], 15),
    ...row(3, ['PageDown'], 15),
    ...row(4, ['ArrowUp', 'End'], 14),
    ...row(5, ARROWS_BOTTOM),
  ],
  tkl: (g) => [...functionAndNav(), ...alpha(g, 1.5, 'Backquote'), ...row(5.5, FULL_BOTTOM)],
  full: (g) => [
    ...functionAndNav(),
    ...alpha(g, 1.5, 'Backquote'),
    ...row(5.5, FULL_BOTTOM),
    ...row(1.5, ['NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract'], 18.5),
    ...row(2.5, ['Numpad7', 'Numpad8', 'Numpad9'], 18.5),
    ...row(3.5, ['Numpad4', 'Numpad5', 'Numpad6'], 18.5),
    ...row(4.5, ['Numpad1', 'Numpad2', 'Numpad3'], 18.5),
    ...row(5.5, [['Numpad0', 2], 'NumpadDecimal'], 18.5),
    { code: 'NumpadAdd', x: 21.5, y: 2.5, w: 1, h: 2 },
    { code: 'NumpadEnter', x: 21.5, y: 4.5, w: 1, h: 2 },
  ],
  laptop: (g) => [
    ...row(0, ['Escape', ...F_KEYS, 'Delete'].map((c) => [c, 15 / 14] as Spec), 0, 0.6),
    ...alpha(g, 0.6, 'Backquote'),
    ...row(4.6, [['ControlLeft', 1.25], 'Fn', ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 4.75], ['AltRight', 1.25], ['ControlRight', 1.25], 'ArrowLeft', 1, 'ArrowRight']),
    { code: 'ArrowUp', x: 13, y: 4.6, w: 1, h: 0.5 },
    { code: 'ArrowDown', x: 13, y: 5.1, w: 1, h: 0.5 },
  ],
};

/** The keys of a keyboard of the given size and shape, with their positions. */
export function buildBoard(size: SizeId, geometry: Geometry): Board {
  const placed = BUILDERS[size](geometry);
  return {
    keys: placed,
    width: Math.max(...placed.map((k) => k.x + k.w)),
    height: Math.max(...placed.map((k) => k.y + k.h)),
  };
}
