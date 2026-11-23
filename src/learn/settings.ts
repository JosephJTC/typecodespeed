import type { Hand } from './fingers';
import type { SizeId } from './geometry';
import { LAYOUTS, type Geometry, type LayoutId } from './layouts';

export type KeyHighlight = 'fingers' | 'target' | 'none';
export type HandsMode = 'animated' | 'static' | 'none';
/** Where the hands are drawn: over the keyboard, next to it or under it. */
export type HandsPosition = 'overlay' | 'side' | 'below';
export type GuidanceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Keyboard configuration and guidance preferences of the Learn section. */
export interface LearnSettings {
  layout: LayoutId;
  geometry: Geometry;
  size: SizeId;
  spaceThumb: Hand;
  /** Names the recommended finger next to the target. */
  fingerGuide: boolean;
  keyHighlight: KeyHighlight;
  hands: HandsMode;
  handsPosition: HandsPosition;
}

export const DEFAULT_LEARN: LearnSettings = {
  layout: 'es-latam',
  geometry: LAYOUTS['es-latam'].geometry,
  size: 'tkl',
  spaceThumb: 'right',
  fingerGuide: true,
  keyHighlight: 'fingers',
  hands: 'animated',
  handsPosition: 'overlay',
};

type Guidance = Pick<LearnSettings, 'fingerGuide' | 'keyHighlight' | 'hands'>;

/** Guidance shown at each level: everything, only the target, or almost nothing. */
export const LEVELS: Readonly<Record<GuidanceLevel, Guidance>> = {
  beginner: { fingerGuide: true, keyHighlight: 'fingers', hands: 'animated' },
  intermediate: { fingerGuide: true, keyHighlight: 'target', hands: 'static' },
  advanced: { fingerGuide: false, keyHighlight: 'none', hands: 'none' },
};

/** The level whose guidance matches the settings, or `custom` when they were changed one by one. */
export function levelOf(s: Guidance): GuidanceLevel | 'custom' {
  const match = (Object.keys(LEVELS) as GuidanceLevel[]).find((l) => {
    const g = LEVELS[l];
    return g.fingerGuide === s.fingerGuide && g.keyHighlight === s.keyHighlight && g.hands === s.hands;
  });
  return match ?? 'custom';
}

/** Drops values that are not valid choices (old or hand-edited settings). */
export function sanitizeLearn(s: LearnSettings): LearnSettings {
  const pick = <T,>(v: T, ok: readonly T[], def: T) => (ok.includes(v) ? v : def);
  const d = DEFAULT_LEARN;
  return {
    layout: pick(s.layout, Object.keys(LAYOUTS) as LayoutId[], d.layout),
    geometry: pick(s.geometry, ['ansi', 'iso'], d.geometry),
    size: pick(s.size, ['full', 'tkl', '75', '65', '60', 'laptop'], d.size),
    spaceThumb: pick(s.spaceThumb, ['left', 'right'], d.spaceThumb),
    fingerGuide: typeof s.fingerGuide === 'boolean' ? s.fingerGuide : d.fingerGuide,
    keyHighlight: pick(s.keyHighlight, ['fingers', 'target', 'none'], d.keyHighlight),
    hands: pick(s.hands, ['animated', 'static', 'none'], d.hands),
    handsPosition: pick(s.handsPosition, ['overlay', 'side', 'below'], d.handsPosition),
  };
}
