import type { Layout, Stroke } from './layouts';

export type LessonKind = 'keys' | 'words' | 'sentences' | 'timed';

export interface Lesson {
  id: string;
  /** Stage 1–8 of the curriculum. */
  stage: number;
  kind: LessonKind;
  /** Characters introduced by the lesson, for the selected keyboard. */
  chars: string[];
  /** Whether the lesson is defined by key positions (its title lists the keys). */
  positional: boolean;
  /** Seconds of a timed lesson. */
  seconds?: number;
}

type CharMap = ReadonlyMap<string, Stroke[]>;

interface LessonDef {
  id: string;
  stage: number;
  kind: LessonKind;
  /** Keys introduced, by position: their base character depends on the layout. */
  codes?: string[];
  /** Characters introduced; those the keyboard cannot type are skipped. */
  chars?: string;
  seconds?: number;
}

const k = (names: string) => names.split(' ').map((n) => (n.length === 1 ? `Key${n}` : n));

/** The curriculum, in order. Key lessons name positions, so they adapt to the layout. */
const DEFS: LessonDef[] = [
  { id: 'home-fj', stage: 1, kind: 'keys', codes: k('F J') },
  { id: 'home-dk', stage: 1, kind: 'keys', codes: k('D K') },
  { id: 'home-sl', stage: 1, kind: 'keys', codes: k('S L') },
  { id: 'home-a', stage: 1, kind: 'keys', codes: k('A Semicolon') },
  { id: 'home-all', stage: 2, kind: 'keys' },
  { id: 'home-gh', stage: 2, kind: 'keys', codes: k('G H') },
  { id: 'home-words', stage: 2, kind: 'words' },
  { id: 'top-ru', stage: 3, kind: 'keys', codes: k('R U') },
  { id: 'top-ei', stage: 3, kind: 'keys', codes: k('E I') },
  { id: 'top-wo', stage: 3, kind: 'keys', codes: k('W O') },
  { id: 'top-qp', stage: 3, kind: 'keys', codes: k('Q P') },
  { id: 'top-ty', stage: 3, kind: 'keys', codes: k('T Y') },
  { id: 'bottom-vm', stage: 4, kind: 'keys', codes: k('V M') },
  { id: 'bottom-c', stage: 4, kind: 'keys', codes: k('C Comma') },
  { id: 'bottom-x', stage: 4, kind: 'keys', codes: k('X Period') },
  { id: 'bottom-z', stage: 4, kind: 'keys', codes: k('Z Slash') },
  { id: 'bottom-bn', stage: 4, kind: 'keys', codes: k('B N') },
  { id: 'full-caps', stage: 5, kind: 'keys', chars: 'ASDFJKLERUIOTN' },
  { id: 'full-digits-left', stage: 5, kind: 'keys', chars: '12345' },
  { id: 'full-digits-right', stage: 5, kind: 'keys', chars: '67890' },
  { id: 'full-accents', stage: 5, kind: 'keys', chars: 'áéíóúü' },
  { id: 'full-punctuation', stage: 5, kind: 'keys', chars: ';:?!¿¡\'"-' },
  { id: 'full-symbols', stage: 5, kind: 'keys', chars: '()[]{}<>=+*/_#&|\\@$%' },
  { id: 'words-short', stage: 6, kind: 'words' },
  { id: 'words-long', stage: 6, kind: 'words' },
  { id: 'sentences-simple', stage: 7, kind: 'sentences' },
  { id: 'sentences-full', stage: 7, kind: 'sentences' },
  { id: 'speed-30', stage: 8, kind: 'timed', seconds: 30 },
  { id: 'speed-60', stage: 8, kind: 'timed', seconds: 60 },
];

export const STAGES = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * The lessons for a keyboard. Lessons that would introduce nothing the
 * keyboard can type (accents on an English layout) are left out.
 */
export function buildCurriculum(layout: Layout, map: CharMap): Lesson[] {
  const lessons: Lesson[] = [];
  for (const d of DEFS) {
    const wanted = d.codes ? d.codes.map((c) => layout.keys[c]?.base ?? '') : [...(d.chars ?? '')];
    const chars = wanted.filter((ch) => ch && map.has(ch));
    if ((d.codes || d.chars) && chars.length === 0) continue;
    lessons.push({ id: d.id, stage: d.stage, kind: d.kind, chars, positional: !!d.codes, seconds: d.seconds });
  }
  return lessons;
}

/** Characters taught up to and including the lesson, plus the space. */
export function learnedChars(lessons: readonly Lesson[], id: string): string[] {
  const out = new Set<string>([' ']);
  for (const l of lessons) {
    for (const ch of l.chars) out.add(ch);
    if (l.id === id) break;
  }
  return [...out];
}
