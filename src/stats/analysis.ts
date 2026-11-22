import type { ErrorKind, TokenType } from '../engine';
import type { CharClass, KeyStat, TestRecord } from './types';

export const errorRate = (s: KeyStat): number => (s.attempts ? s.errors / s.attempts : 0);
export const avgDelay = (s: KeyStat): number | null => (s.timed ? s.timeMs / s.timed : null);

function mergeStat(into: KeyStat, s: KeyStat) {
  into.attempts += s.attempts;
  into.errors += s.errors;
  into.timeMs += s.timeMs;
  into.timed += s.timed;
}

function mergeMaps<K extends string>(maps: Array<Partial<Record<K, KeyStat>>>): Partial<Record<K, KeyStat>> {
  const out: Partial<Record<K, KeyStat>> = {};
  for (const m of maps) {
    for (const [k, s] of Object.entries(m) as Array<[K, KeyStat]>) {
      mergeStat((out[k] ??= { attempts: 0, errors: 0, timeMs: 0, timed: 0 }), s);
    }
  }
  return out;
}

export interface DifficultKey<K extends string = string> {
  key: K;
  attempts: number;
  errors: number;
  errorRate: number;
  /** Average delay before pressing it, in ms; null when it was never timed. */
  avgMs: number | null;
  /** avgMs relative to the average delay of all keys (1 = average). */
  slowness: number | null;
  /** Combined difficulty used for ranking. */
  score: number;
}

/**
 * Ranks keys by difficulty: mostly by error rate, plus how much slower than the
 * user's own average they are typed. Keys with too few attempts are left out
 * because their rates are not reliable.
 */
export function rankDifficulty<K extends string>(stats: Partial<Record<K, KeyStat>>, minAttempts = 3): DifficultKey<K>[] {
  const entries = Object.entries(stats) as Array<[K, KeyStat]>;
  const totalMs = entries.reduce((a, [, s]) => a + s.timeMs, 0);
  const totalTimed = entries.reduce((a, [, s]) => a + s.timed, 0);
  const baseline = totalTimed ? totalMs / totalTimed : 0;
  return entries
    .filter(([, s]) => s.attempts >= minAttempts)
    .map(([key, s]) => {
      const avgMs = avgDelay(s);
      const slowness = avgMs !== null && baseline > 0 ? avgMs / baseline : null;
      const rate = errorRate(s);
      return { key, attempts: s.attempts, errors: s.errors, errorRate: rate, avgMs, slowness, score: rate + 0.15 * Math.max(0, (slowness ?? 1) - 1) };
    })
    .sort((a, b) => b.score - a.score || b.attempts - a.attempts || a.key.localeCompare(b.key));
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface Summary {
  tests: number;
  totalTimeMs: number;
  totalChars: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  bestAccuracy: number;
  avgCps: number;
  avgConsistency: number;
  avgCompletion: number;
  errorsByKind: Partial<Record<ErrorKind, number>>;
  chars: Record<string, KeyStat>;
  tokenTypes: Partial<Record<TokenType, KeyStat>>;
  charClasses: Partial<Record<CharClass, KeyStat>>;
  confusions: Array<{ expected: string; typed: string; count: number }>;
}

/**
 * Aggregates several tests. Averages of speed are weighted by duration and
 * accuracy by evaluated keystrokes, so short tests do not distort them.
 */
export function summarize(records: readonly TestRecord[]): Summary {
  const totalTimeMs = records.reduce((a, r) => a + r.durationMs, 0);
  const totalChars = records.reduce((a, r) => a + r.correctChars, 0);
  const totalEvaluated = records.reduce((a, r) => a + r.evaluated, 0);
  const errorsByKind: Partial<Record<ErrorKind, number>> = {};
  const confusions = new Map<string, number>();
  for (const r of records) {
    for (const [k, n] of Object.entries(r.errorsByKind) as Array<[ErrorKind, number]>) errorsByKind[k] = (errorsByKind[k] ?? 0) + n;
    for (const c of r.confusions) {
      const key = `${c.expected}\u0000${c.typed}`;
      confusions.set(key, (confusions.get(key) ?? 0) + c.count);
    }
  }
  const minutes = totalTimeMs / 60000;
  return {
    tests: records.length,
    totalTimeMs,
    totalChars,
    avgWpm: minutes > 0 ? totalChars / 5 / minutes : 0,
    bestWpm: Math.max(0, ...records.map((r) => r.wpm)),
    avgAccuracy: totalEvaluated ? records.reduce((a, r) => a + r.accuracy * r.evaluated, 0) / totalEvaluated : mean(records.map((r) => r.accuracy)),
    bestAccuracy: Math.max(0, ...records.map((r) => r.accuracy)),
    avgCps: totalTimeMs > 0 ? totalChars / (totalTimeMs / 1000) : 0,
    avgConsistency: mean(records.map((r) => r.consistency)),
    avgCompletion: mean(records.map((r) => r.completion)),
    errorsByKind,
    chars: mergeMaps(records.map((r) => r.chars)) as Record<string, KeyStat>,
    tokenTypes: mergeMaps(records.map((r) => r.tokenTypes)),
    charClasses: mergeMaps(records.map((r) => r.charClasses)),
    confusions: [...confusions.entries()]
      .map(([key, count]) => {
        const [expected, typed] = key.split('\u0000');
        return { expected, typed, count };
      })
      .sort((a, b) => b.count - a.count || a.expected.localeCompare(b.expected)),
  };
}

export interface MetricDelta {
  a: number;
  b: number;
  /** b − a. */
  delta: number;
  /** Whether b is better than a (null when equal). */
  better: boolean | null;
}

export type ComparedMetric = 'wpm' | 'rawWpm' | 'cps' | 'accuracy' | 'consistency' | 'completion' | 'errorsMade' | 'uncorrected' | 'corrections' | 'durationMs';

const LOWER_IS_BETTER: ReadonlySet<ComparedMetric> = new Set(['errorsMade', 'uncorrected', 'corrections']);
const NEUTRAL: ReadonlySet<ComparedMetric> = new Set(['durationMs']);
export const COMPARED_METRICS: ComparedMetric[] = ['wpm', 'rawWpm', 'cps', 'accuracy', 'consistency', 'completion', 'errorsMade', 'uncorrected', 'corrections', 'durationMs'];

type MetricValues = Pick<TestRecord, ComparedMetric>;

/** Compares `b` against the baseline `a`, metric by metric. */
export function compareRecords(a: MetricValues, b: MetricValues): Record<ComparedMetric, MetricDelta> {
  const out = {} as Record<ComparedMetric, MetricDelta>;
  for (const m of COMPARED_METRICS) {
    const delta = b[m] - a[m];
    const better = NEUTRAL.has(m) || Math.abs(delta) < 1e-9 ? null : LOWER_IS_BETTER.has(m) ? delta < 0 : delta > 0;
    out[m] = { a: a[m], b: b[m], delta, better };
  }
  return out;
}

/** Plain averages of the compared metrics, to compare one test against a group of earlier ones. */
export function averageMetrics(records: readonly TestRecord[]): MetricValues | null {
  if (records.length === 0) return null;
  const out = {} as MetricValues;
  for (const m of COMPARED_METRICS) out[m] = mean(records.map((r) => r[m]));
  return out;
}

export interface ProgressPoint {
  index: number;
  id: string;
  finishedAt: number;
  wpm: number;
  accuracy: number;
  cps: number;
  /** Average of this test and the previous ones inside the window. */
  wpmAvg: number;
  accuracyAvg: number;
}

/** Tests in chronological order with a moving average, for the progress charts. */
export function progress(records: readonly TestRecord[], window = 5): ProgressPoint[] {
  const sorted = [...records].sort((a, b) => a.finishedAt - b.finishedAt);
  return sorted.map((r, i) => {
    const slice = sorted.slice(Math.max(0, i - window + 1), i + 1);
    return {
      index: i + 1,
      id: r.id,
      finishedAt: r.finishedAt,
      wpm: r.wpm,
      accuracy: r.accuracy,
      cps: r.cps,
      wpmAvg: mean(slice.map((x) => x.wpm)),
      accuracyAvg: mean(slice.map((x) => x.accuracy)),
    };
  });
}

export interface Trend {
  /** Average of the most recent tests. */
  recent: number;
  /** Average of the tests before those. */
  previous: number;
  delta: number;
}

/** Compares the last `n` tests against the `n` before them; null without enough history. */
export function trend(records: readonly TestRecord[], metric: 'wpm' | 'accuracy', n = 5): Trend | null {
  const sorted = [...records].sort((a, b) => a.finishedAt - b.finishedAt);
  if (sorted.length < 2) return null;
  const size = Math.min(n, Math.floor(sorted.length / 2));
  const recent = mean(sorted.slice(-size).map((r) => r[metric]));
  const previous = mean(sorted.slice(-2 * size, -size).map((r) => r[metric]));
  return { recent, previous, delta: recent - previous };
}

export type Insight =
  | { kind: 'difficultChar'; char: string; errorRate: number; attempts: number }
  | { kind: 'slowChar'; char: string; slowness: number; avgMs: number }
  | { kind: 'confusion'; expected: string; typed: string; count: number }
  | { kind: 'errorKind'; error: ErrorKind; share: number; count: number }
  | { kind: 'tokenType'; tokenType: TokenType; errorRate: number }
  | { kind: 'charClass'; charClass: CharClass; errorRate: number }
  | { kind: 'lowAccuracy'; accuracy: number }
  | { kind: 'manyCorrections'; perHundred: number }
  | { kind: 'inconsistent'; consistency: number }
  | { kind: 'trend'; metric: 'wpm' | 'accuracy'; delta: number };

/**
 * Turns aggregated statistics into concrete observations, most relevant first.
 * Thresholds are deliberately conservative so that noise is not reported as a weakness.
 */
export function insights(records: readonly TestRecord[]): Insight[] {
  if (records.length === 0) return [];
  const s = summarize(records);
  const out: Insight[] = [];

  if (s.avgAccuracy < 0.95) out.push({ kind: 'lowAccuracy', accuracy: s.avgAccuracy });

  const chars = rankDifficulty(s.chars, 8);
  for (const c of chars.filter((c) => c.errorRate >= 0.1).slice(0, 3)) {
    out.push({ kind: 'difficultChar', char: c.key, errorRate: c.errorRate, attempts: c.attempts });
  }
  const slow = chars
    .filter((c) => c.slowness !== null && c.avgMs !== null && c.slowness >= 1.6 && c.errorRate < 0.1)
    .sort((a, b) => b.slowness! - a.slowness!)
    .slice(0, 2);
  for (const c of slow) out.push({ kind: 'slowChar', char: c.key, slowness: c.slowness!, avgMs: c.avgMs! });

  for (const c of s.confusions.filter((c) => c.count >= 3).slice(0, 2)) out.push({ kind: 'confusion', ...c });

  const totalErrors = Object.values(s.errorsByKind).reduce((a, n) => a + (n ?? 0), 0);
  const kinds = (Object.entries(s.errorsByKind) as Array<[ErrorKind, number]>).sort((a, b) => b[1] - a[1]);
  const top = kinds[0];
  if (top && top[0] !== 'substitution' && totalErrors >= 5 && top[1] / totalErrors >= 0.3) {
    out.push({ kind: 'errorKind', error: top[0], share: top[1] / totalErrors, count: top[1] });
  }

  const overall = totalErrors && s.avgAccuracy < 1 ? 1 - s.avgAccuracy : 0;
  const worstType = rankDifficulty(s.tokenTypes, 20).find((t) => t.key !== 'whitespace');
  if (worstType && worstType.errorRate >= 0.08 && worstType.errorRate >= overall * 1.5) {
    out.push({ kind: 'tokenType', tokenType: worstType.key, errorRate: worstType.errorRate });
  }
  const worstClass = rankDifficulty(s.charClasses, 20)[0];
  if (worstClass && worstClass.errorRate >= 0.08 && worstClass.errorRate >= overall * 1.5) {
    out.push({ kind: 'charClass', charClass: worstClass.key, errorRate: worstClass.errorRate });
  }

  const keystrokes = records.reduce((a, r) => a + r.keystrokes, 0);
  const corrections = records.reduce((a, r) => a + r.corrections, 0);
  if (keystrokes >= 100 && corrections / keystrokes >= 0.1) out.push({ kind: 'manyCorrections', perHundred: (corrections / keystrokes) * 100 });

  if (s.avgConsistency < 0.6 && s.totalTimeMs >= 30_000) out.push({ kind: 'inconsistent', consistency: s.avgConsistency });

  for (const metric of ['wpm', 'accuracy'] as const) {
    const t = records.length >= 6 ? trend(records, metric) : null;
    if (!t) continue;
    const significant = metric === 'wpm' ? Math.abs(t.delta) >= Math.max(1, t.previous * 0.05) : Math.abs(t.delta) >= 0.01;
    if (significant) out.push({ kind: 'trend', metric, delta: t.delta });
  }
  return out;
}

/** Earlier tests that are comparable to `record`: same kind of test and comparison mode. */
export function comparableTo(record: TestRecord, all: readonly TestRecord[]): TestRecord[] {
  return all.filter(
    (r) => r.id !== record.id && r.finishedAt <= record.finishedAt && r.testType === record.testType && r.mode === record.mode && (r.timeLimitMs ?? 0) === (record.timeLimitMs ?? 0),
  );
}

export interface SourceSummary {
  sourceId: string;
  sourceName: string;
  tests: number;
  avgWpm: number;
  bestWpm: number;
  avgAccuracy: number;
  lastAt: number;
}

/** Performance grouped by practiced code (reference, sample…), most recently practiced first. */
export function bySource(records: readonly TestRecord[]): SourceSummary[] {
  const groups = new Map<string, TestRecord[]>();
  for (const r of records) groups.set(r.sourceId, [...(groups.get(r.sourceId) ?? []), r]);
  return [...groups.entries()]
    .map(([sourceId, list]) => {
      const s = summarize(list);
      const last = list.reduce((a, b) => (b.finishedAt > a.finishedAt ? b : a));
      return { sourceId, sourceName: last.sourceName, tests: list.length, avgWpm: s.avgWpm, bestWpm: s.bestWpm, avgAccuracy: s.avgAccuracy, lastAt: last.finishedAt };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}
