/**
 * Keyboard layouts: which characters each physical key produces. Keys are
 * identified by `KeyboardEvent.code`, i.e. by position, not by character.
 */

export type LayoutId = 'es-latam' | 'es-es' | 'en-us' | 'en-uk';
/** Shape of the alphanumeric block: ANSI (wide Enter) or ISO (tall Enter and a key next to the left Shift). */
export type Geometry = 'ansi' | 'iso';
export type DeadMark = 'acute' | 'grave' | 'diaeresis' | 'circumflex';

/** Characters of a key by level; a `DeadMark` is a dead key that combines with the next letter. */
export interface KeyChars {
  base?: string;
  shift?: string;
  altgr?: string;
  deadBase?: DeadMark;
  deadShift?: DeadMark;
}

export interface Layout {
  id: LayoutId;
  /** Language of the words and sentences used in the exercises. */
  language: 'es' | 'en';
  /** Shape the layout is usually sold with. */
  geometry: Geometry;
  /** Whether the right Alt is AltGr (third level). */
  altGr: boolean;
  keys: Readonly<Record<string, KeyChars>>;
}

const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM';
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

const EMPTY = '∅';

/** `'a A @'`-style rows: base, shift and AltGr characters separated by spaces; `∅` leaves a level empty. */
function parse(spec: Record<string, string>, dead: Record<string, [DeadMark?, DeadMark?]> = {}): Record<string, KeyChars> {
  const keys: Record<string, KeyChars> = {};
  for (const l of LETTERS) keys[`Key${l}`] = { base: l.toLowerCase(), shift: l };
  for (const [code, text] of Object.entries(spec)) {
    const [base, shift, altgr] = text.split(' ').map((x) => (x === EMPTY ? undefined : x));
    keys[code] = { ...keys[code], ...(base && { base }), ...(shift && { shift }), ...(altgr && { altgr }) };
  }
  for (const [code, [deadBase, deadShift]] of Object.entries(dead)) keys[code] = { ...keys[code], deadBase, deadShift };
  return keys;
}

const digits = (shifted: string, altgr: Record<number, string> = {}) =>
  Object.fromEntries(DIGITS.map((code, i) => [code, `${(i + 1) % 10} ${shifted[i]}${altgr[i] ? ` ${altgr[i]}` : ''}`]));

export const LAYOUTS: Readonly<Record<LayoutId, Layout>> = {
  'es-latam': {
    id: 'es-latam',
    language: 'es',
    geometry: 'iso',
    altGr: true,
    keys: parse(
      {
        ...digits('!"#$%&/()='),
        Backquote: '| ° ¬',
        Minus: "' ? \\",
        Equal: '¿ ¡',
        BracketLeft: '∅',
        BracketRight: '+ * ~',
        Backslash: '} ] `',
        Semicolon: 'ñ Ñ',
        Quote: '{ [ ^',
        Comma: ', ;',
        Period: '. :',
        Slash: '- _',
        IntlBackslash: '< >',
        KeyQ: 'q Q @',
      },
      { BracketLeft: ['acute', 'diaeresis'] },
    ),
  },
  'es-es': {
    id: 'es-es',
    language: 'es',
    geometry: 'iso',
    altGr: true,
    keys: parse(
      {
        ...digits('!"·$%&/()=', { 0: '|', 1: '@', 2: '#', 3: '~', 4: '€', 5: '¬' }),
        Backquote: 'º ª \\',
        Minus: "' ?",
        Equal: '¡ ¿',
        BracketLeft: '∅ ∅ [',
        BracketRight: '+ * ]',
        Backslash: 'ç Ç }',
        Semicolon: 'ñ Ñ',
        Quote: '∅ ∅ {',
        Comma: ', ;',
        Period: '. :',
        Slash: '- _',
        IntlBackslash: '< >',
        KeyE: 'e E €',
      },
      { BracketLeft: ['grave', 'circumflex'], Quote: ['acute', 'diaeresis'] },
    ),
  },
  'en-us': {
    id: 'en-us',
    language: 'en',
    geometry: 'ansi',
    altGr: false,
    keys: parse({
      ...digits('!@#$%^&*()'),
      Backquote: '` ~',
      Minus: '- _',
      Equal: '= +',
      BracketLeft: '[ {',
      BracketRight: '] }',
      Backslash: '\\ |',
      Semicolon: '; :',
      Quote: '\' "',
      Comma: ', <',
      Period: '. >',
      Slash: '/ ?',
      IntlBackslash: '\\ |',
    }),
  },
  'en-uk': {
    id: 'en-uk',
    language: 'en',
    geometry: 'iso',
    altGr: true,
    keys: parse({
      ...digits('!"£$%^&*()', { 3: '€' }),
      Backquote: '` ¬ ¦',
      Minus: '- _',
      Equal: '= +',
      BracketLeft: '[ {',
      BracketRight: '] }',
      Backslash: '# ~',
      Semicolon: '; :',
      Quote: "' @",
      Comma: ', <',
      Period: '. >',
      Slash: '/ ?',
      IntlBackslash: '\\ |',
    }),
  },
};

export const LAYOUT_IDS = Object.keys(LAYOUTS) as LayoutId[];

const DEAD_LETTERS: Record<DeadMark, Record<string, string>> = {
  acute: { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú' },
  diaeresis: { u: 'ü', U: 'Ü' },
  grave: { a: 'à', e: 'è', o: 'ò' },
  circumflex: {},
};

/** One key press of a keystroke sequence, with the modifier it needs. */
export interface Stroke {
  code: string;
  shift?: boolean;
  altgr?: boolean;
}

/**
 * How to type every character the layout can produce on a keyboard that has
 * the keys in `available`: usually one stroke, two for accented letters
 * (dead key, then the letter). Earlier levels win when a character repeats.
 */
export function charMap(layout: Layout, available: ReadonlySet<string>): Map<string, Stroke[]> {
  const map = new Map<string, Stroke[]>();
  const add = (ch: string | undefined, strokes: Stroke[]) => {
    if (ch && !map.has(ch) && strokes.every((s) => available.has(s.code))) map.set(ch, strokes);
  };
  const entries = Object.entries(layout.keys);
  for (const [code, k] of entries) add(k.base, [{ code }]);
  for (const [code, k] of entries) add(k.shift, [{ code, shift: true }]);
  if (layout.altGr) for (const [code, k] of entries) add(k.altgr, [{ code, altgr: true }]);
  add(' ', [{ code: 'Space' }]);
  add('\n', [{ code: 'Enter' }]);
  add('\t', [{ code: 'Tab' }]);
  for (const [code, k] of entries) {
    for (const [mark, shift] of [[k.deadBase, false], [k.deadShift, true]] as const) {
      if (!mark) continue;
      for (const [letter, composed] of Object.entries(DEAD_LETTERS[mark])) {
        const second = map.get(letter);
        if (second?.length === 1) add(composed, [{ code, ...(shift && { shift }) }, second[0]]);
      }
    }
  }
  return map;
}

/** Character shown on a key cap: the base level, in upper case for letters. */
export function keyLabel(layout: Layout, code: string): string | undefined {
  const k = layout.keys[code];
  if (!k) return undefined;
  if (k.deadBase) return { acute: '´', grave: '`', diaeresis: '¨', circumflex: '^' }[k.deadBase];
  return k.base && /^\p{Ll}$/u.test(k.base) ? k.base.toUpperCase() : k.base;
}
