import { LAYOUT_IDS, LAYOUTS, type Geometry, type LayoutId } from './layouts';

/** A key the user is asked to press, described by where it is. */
export interface DetectStep {
  id: 'nextToShift' | 'beforeBackspace' | 'nextToEnter';
  /** Positions the key may have, depending on the shape of the board. */
  codes: string[];
}

export const DETECT_STEPS: DetectStep[] = [
  // ISO boards have an extra key here; on ANSI the neighbour is already Z.
  { id: 'nextToShift', codes: ['IntlBackslash', 'KeyZ'] },
  { id: 'beforeBackspace', codes: ['Equal'] },
  // Left of Enter on the home row (ISO) or above Enter (ANSI): same code.
  { id: 'nextToEnter', codes: ['Backslash', 'Quote'] },
];

/** What the browser reported for a key press. */
export interface KeySample {
  code: string;
  key: string;
}

export interface Detection {
  layout: LayoutId;
  geometry: Geometry;
  /** Whether the answers did not point clearly at one layout. */
  uncertain: boolean;
  /** Why it is uncertain: no position information, an unexpected key, or several layouts fit equally. */
  reason?: 'noCodes' | 'unexpectedKey' | 'ambiguous';
}

function matches(layout: LayoutId, s: KeySample): boolean {
  const k = LAYOUTS[layout].keys[s.code];
  if (!k) return false;
  if (s.key === 'Dead') return !!k.deadBase;
  return k.base === s.key || k.base === s.key.toLowerCase();
}

/**
 * Infers the layout from the keys pressed during the guided detection. The
 * browser reports each key's position and character, never the keyboard
 * model, so the result is the most likely layout and may be uncertain.
 */
export function detectLayout(samples: readonly (KeySample | null)[], fallback: LayoutId): Detection {
  const given = samples.filter((s): s is KeySample => !!s);
  const usable = given.filter((s) => s.code);
  const first = samples[0];
  const geometry: Geometry | undefined = first?.code === 'IntlBackslash' ? 'iso' : first?.code === 'KeyZ' ? 'ansi' : undefined;
  if (usable.length === 0) {
    return { layout: fallback, geometry: geometry ?? LAYOUTS[fallback].geometry, uncertain: true, reason: 'noCodes' };
  }
  const scores = LAYOUT_IDS.map((id) => ({ id, score: usable.filter((s) => matches(id, s)).length + (geometry === LAYOUTS[id].geometry ? 0.5 : 0) }));
  scores.sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  const unexpected = samples.some((s, i) => s && !DETECT_STEPS[i].codes.includes(s.code));
  const ambiguous = best.score === second.score || Math.floor(best.score) < usable.length;
  return {
    layout: best.score > 0 ? best.id : fallback,
    geometry: geometry ?? LAYOUTS[best.id].geometry,
    uncertain: unexpected || ambiguous || usable.length < samples.length,
    reason: unexpected ? 'unexpectedKey' : ambiguous || usable.length < samples.length ? 'ambiguous' : undefined,
  };
}
