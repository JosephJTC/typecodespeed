import type { TokenType } from '../engine';
import type { KeystrokeLog, SessionSnapshot } from '../session';
import { RECORD_VERSION, type Bucket, type CharClass, type KeyStat, type TestMeta, type TestRecord } from './types';

/** Delays longer than this are hesitations or interruptions, not typing rhythm. */
export const MAX_KEY_DELAY_MS = 5000;
const MAX_BUCKETS = 60;
const MAX_CONFUSIONS = 20;

export function charClassOf(ch: string): CharClass {
  if (/\s/.test(ch)) return 'whitespace';
  if (/\p{L}|_/u.test(ch)) return 'letter';
  if (/\p{N}/u.test(ch)) return 'digit';
  return 'symbol';
}

const emptyStat = (): KeyStat => ({ attempts: 0, errors: 0, timeMs: 0, timed: 0 });

function bump<K extends string>(map: Partial<Record<K, KeyStat>>, key: K, error: boolean, delay: number | undefined) {
  const stat = (map[key] ??= emptyStat());
  stat.attempts++;
  if (error) stat.errors++;
  if (delay !== undefined) {
    stat.timeMs += delay;
    stat.timed++;
  }
}

/** A keystroke counts as correct when it matched the code or was whitespace the mode allows. */
export function isCorrectKey(k: KeystrokeLog): boolean {
  return k.status === 'correct' || (k.status === 'free' && k.ch !== undefined && /\s/.test(k.ch));
}

export const isErrorKey = (k: KeystrokeLog): boolean => k.status === 'error' || k.status === 'rejected';

/** Interval length that keeps the timeline at `MAX_BUCKETS` points or fewer, in whole seconds. */
export function bucketSizeFor(durationMs: number): number {
  return Math.max(1, Math.ceil(durationMs / 1000 / MAX_BUCKETS)) * 1000;
}

export function buildBuckets(log: readonly KeystrokeLog[], durationMs: number, bucketMs = bucketSizeFor(durationMs)): Bucket[] {
  const count = Math.max(1, Math.ceil(durationMs / bucketMs));
  const buckets: Bucket[] = Array.from({ length: count }, (_, i) => ({
    t: i * bucketMs,
    ms: Math.min(bucketMs, Math.max(0, durationMs - i * bucketMs)) || bucketMs,
    correct: 0,
    errors: 0,
    typed: 0,
    corrections: 0,
  }));
  for (const k of log) {
    if (k.auto) continue;
    const b = buckets[Math.min(count - 1, Math.max(0, Math.floor(k.t / bucketMs)))];
    if (k.kind !== 'char') {
      b.corrections++;
      continue;
    }
    if (k.status !== 'rejected') b.typed++;
    if (isErrorKey(k)) b.errors++;
    else if (isCorrectKey(k)) b.correct++;
  }
  return buckets;
}

/**
 * 1 − coefficient of variation of the per-interval speed, clamped to 0..1.
 * Intervals that are too short to be representative are left out.
 */
export function consistencyOf(buckets: readonly Bucket[]): number {
  const speeds = buckets.filter((b) => b.ms >= 500).map((b) => b.correct / (b.ms / 1000));
  if (speeds.length < 2) return 1;
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  if (mean === 0) return 0;
  const variance = speeds.reduce((a, b) => a + (b - mean) ** 2, 0) / speeds.length;
  return Math.min(1, Math.max(0, 1 - Math.sqrt(variance) / mean));
}

export function hashText(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export interface RecordInput {
  log: readonly KeystrokeLog[];
  snapshot: SessionSnapshot;
  meta: TestMeta;
  /** Every text of the session, in order. */
  texts: readonly string[];
  finishedAt: number;
  id: string;
}

/** Builds the stored record of a test from its keystroke log and final snapshot. */
export function buildRecord({ log, snapshot: s, meta, texts, finishedAt, id }: RecordInput): TestRecord {
  const chars: Record<string, KeyStat> = {};
  const tokenTypes: Partial<Record<TokenType, KeyStat>> = {};
  const charClasses: Partial<Record<CharClass, KeyStat>> = {};
  const confusions = new Map<string, number>();
  let keystrokes = 0;
  let evaluated = 0;
  let prev: KeystrokeLog | undefined;

  for (const k of log) {
    if (k.auto) continue;
    const delay = prev && prev.segment === k.segment && k.t - prev.t <= MAX_KEY_DELAY_MS ? Math.max(0, k.t - prev.t) : undefined;
    prev = k;
    if (k.kind !== 'char' || k.ch === undefined) continue;
    if (k.status !== 'rejected') keystrokes++;
    const error = isErrorKey(k);
    if (!error && !isCorrectKey(k)) continue;
    evaluated++;
    if (k.tokenType) bump(tokenTypes, k.tokenType, error, delay);
    if (k.expected !== undefined) {
      bump(chars, k.expected, error, delay);
      bump(charClasses, charClassOf(k.expected), error, delay);
      if (error && k.ch !== k.expected) {
        const key = `${k.expected}\u0000${k.ch}`;
        confusions.set(key, (confusions.get(key) ?? 0) + 1);
      }
    } else if (k.tokenType === 'whitespace') {
      bump(charClasses, 'whitespace', error, delay);
    }
  }

  const durationMs = s.elapsedMs;
  const bucketMs = bucketSizeFor(durationMs);
  const buckets = buildBuckets(log, durationMs, bucketMs);
  const minutes = durationMs / 60000;
  const completion =
    s.finishReason === 'completed'
      ? 1
      : meta.timeLimitMs
        ? Math.min(1, durationMs / meta.timeLimitMs)
        : s.progress;

  return {
    ...meta,
    version: RECORD_VERSION,
    id,
    finishedAt,
    finishReason: s.finishReason ?? 'aborted',
    textHash: hashText(texts.join('\u0000')),
    durationMs,
    wpm: s.wpm,
    rawWpm: s.rawWpm,
    cps: minutes > 0 ? s.sessionCorrectChars / (durationMs / 1000) : 0,
    accuracy: s.accuracy,
    completion,
    consistency: consistencyOf(buckets),
    correctChars: s.sessionCorrectChars,
    totalChars: s.totalChars,
    keystrokes,
    evaluated,
    errorsMade: s.errorsMade,
    uncorrected: s.uncorrected,
    corrections: s.corrections,
    textsCompleted: s.textsCompleted,
    tokensTotal: s.sessionTokensTotal,
    tokensCorrect: s.sessionTokensCorrect,
    lines: texts.reduce((a, t) => a + (t ? t.split('\n').length : 0), 0),
    errorsByKind: { ...s.errorsByKind },
    chars,
    tokenTypes,
    charClasses,
    confusions: [...confusions.entries()]
      .map(([key, count]) => {
        const [expected, typed] = key.split('\u0000');
        return { expected, typed, count };
      })
      .sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected))
      .slice(0, MAX_CONFUSIONS),
    bucketMs,
    buckets,
  };
}

/** Points of the charts drawn from the timeline of one test. */
export interface TimelinePoint {
  /** Middle of the interval, in seconds. */
  t: number;
  cps: number;
  wpm: number;
  rawWpm: number;
  /** Accuracy within the interval; null when nothing was evaluated in it. */
  accuracy: number | null;
  /** Accuracy from the start up to the end of the interval. */
  cumulativeAccuracy: number;
  /** Average speed from the start up to the end of the interval. */
  cumulativeWpm: number;
  errors: number;
}

export function timeline(record: Pick<TestRecord, 'buckets'>): TimelinePoint[] {
  let correct = 0;
  let errors = 0;
  let ms = 0;
  return record.buckets.map((b) => {
    correct += b.correct;
    errors += b.errors;
    ms += b.ms;
    const sec = b.ms / 1000;
    const evaluated = b.correct + b.errors;
    return {
      t: (b.t + b.ms / 2) / 1000,
      cps: b.correct / sec,
      wpm: (b.correct / 5) * (60 / sec),
      rawWpm: (b.typed / 5) * (60 / sec),
      accuracy: evaluated ? b.correct / evaluated : null,
      cumulativeAccuracy: correct + errors ? correct / (correct + errors) : 1,
      cumulativeWpm: ms ? correct / 5 / (ms / 60000) : 0,
      errors: b.errors,
    };
  });
}
