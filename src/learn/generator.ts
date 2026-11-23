import type { Lesson } from './curriculum';
import { SENTENCES, WORDS } from './words';

/** What is known about how the user types one character. */
export interface CharStat {
  attempts: number;
  errors: number;
  /** Total reaction time of the correct presses, in milliseconds. */
  ms: number;
}

export interface GenerateOptions {
  lesson: Lesson;
  /** Characters taught so far (including the lesson's), with the space. */
  learned: readonly string[];
  language: 'es' | 'en';
  stats?: ReadonlyMap<string, CharStat>;
  /** Best accuracy reached before in this lesson (0–1), to adjust the length. */
  bestAccuracy?: number;
  /** Characters the keyboard can type; sentences with others are skipped. */
  canType?: (ch: string) => boolean;
  rand?: () => number;
}

const pick = <T,>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

/**
 * How much a character should be practiced: more when it fails often or is
 * slower than the user's average. Unseen characters count as average.
 */
export function weakness(ch: string, stats: ReadonlyMap<string, CharStat> | undefined): number {
  const s = stats?.get(ch);
  if (!stats || !s || s.attempts < 3) return 1;
  let ms = 0;
  let n = 0;
  for (const x of stats.values()) {
    ms += x.ms;
    n += x.attempts - x.errors;
  }
  const average = n > 0 ? ms / n : 0;
  const own = s.attempts > s.errors ? s.ms / (s.attempts - s.errors) : average;
  const slow = average > 0 ? Math.max(0, Math.min(1, own / average - 1)) : 0;
  return 1 + 4 * (s.errors / s.attempts) + slow;
}

function weighted(chars: readonly string[], weights: readonly number[], rand: () => number): string {
  let r = rand() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < chars.length; i++) {
    r -= weights[i];
    if (r <= 0) return chars[i];
  }
  return chars[chars.length - 1];
}

/** Words that use only the allowed characters. */
function usable(language: 'es' | 'en', allowed: ReadonlySet<string>): string[] {
  return WORDS[language].filter((w) => [...w].every((ch) => allowed.has(ch)));
}

/** Number of groups or words of an exercise: longer once the lesson goes well, shorter while it is hard. */
function lengthFor(base: number, best: number | undefined): number {
  if (best === undefined) return base;
  if (best >= 0.96) return Math.round(base * 1.3);
  if (best < 0.85) return Math.round(base * 0.75);
  return base;
}

function drill(o: GenerateOptions, rand: () => number): string {
  const letters = o.learned.filter((ch) => ch !== ' ');
  const focus = o.lesson.chars.length ? o.lesson.chars : letters;
  const weights = letters.map((ch) => weakness(ch, o.stats) * (focus.includes(ch) ? 3 : 1));
  const words = usable(o.language, new Set(letters)).filter((w) => w.length > 1 && focus.some((ch) => w.includes(ch)));
  const total = lengthFor(16, o.bestAccuracy);
  const groups: string[] = [];

  // Warm-up: each new key on its own, then the new keys alternating.
  for (const ch of o.lesson.chars.slice(0, 4)) groups.push(ch.repeat(3));
  if (o.lesson.chars.length > 1) {
    const [a, b] = o.lesson.chars;
    groups.push(a + b + a, b + a + b);
  }
  while (groups.length < total) {
    const last = groups[groups.length - 1];
    let next = '';
    if (words.length >= 4 && rand() < 0.5) next = pick(words, rand);
    else {
      const size = 3 + Math.floor(rand() * 3);
      // Every group contains a focus key, so the new keys are never left out.
      const at = Math.floor(rand() * size);
      for (let i = 0; i < size; i++) next += i === at ? pick(focus, rand) : weighted(letters, weights, rand);
    }
    if (next !== last) groups.push(next);
  }
  return groups.join(' ');
}

function words(o: GenerateOptions, rand: () => number): string {
  const pool = usable(o.language, new Set(o.learned));
  if (pool.length < 4) return drill(o, rand);
  const long = o.lesson.id.endsWith('long');
  const sized = pool.filter((w) => (long ? w.length >= 5 : w.length <= 5));
  const from = sized.length >= 8 ? sized : pool;
  // Words with the user's weak characters come up more often.
  const weights = from.map((w) => Math.max(...[...w].map((ch) => weakness(ch, o.stats))));
  const out: string[] = [];
  const total = lengthFor(long ? 14 : 18, o.bestAccuracy);
  for (let guard = 0; out.length < total && guard < total * 20; guard++) {
    const w = weighted(from, weights, rand);
    if (w !== out[out.length - 1]) out.push(w);
  }
  return out.join(' ');
}

function sentences(o: GenerateOptions, rand: () => number, count: number): string {
  const canType = o.canType ?? (() => true);
  const set = SENTENCES[o.language];
  const pool = (o.lesson.id.endsWith('simple') ? set.simple : [...set.simple, ...set.full]).filter((s) => [...s].every(canType));
  const out: string[] = [];
  for (let guard = 0; out.length < count && guard < count * 20; guard++) {
    const s = pick(pool, rand);
    if (s !== out[out.length - 1]) out.push(s);
  }
  return out.join(' ');
}

/** Text of an exercise for the lesson, adapted to what the user knows and struggles with. */
export function generateExercise(o: GenerateOptions): string {
  const rand = o.rand ?? Math.random;
  switch (o.lesson.kind) {
    case 'keys':
      return drill(o, rand);
    case 'words':
      return words(o, rand);
    case 'sentences':
      return sentences(o, rand, o.lesson.id.endsWith('simple') ? 3 : 4);
    case 'timed':
      // Enough text for the whole time at any realistic speed.
      return sentences(o, rand, Math.ceil((o.lesson.seconds ?? 30) / 2));
  }
}
