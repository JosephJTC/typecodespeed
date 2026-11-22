import type { CompareOptions, WhitespaceRules } from '../../engine';
import type { ErrorPolicy, SessionConfig } from '../../session';
import type { TestMeta, TestType } from '../../stats';
import { DEFAULT_SNIPPET_OPTIONS, pickSnippet, SAMPLES } from '../../snippets';

export type { TestType } from '../../stats';

export interface PracticeSettings {
  testType: TestType;
  durationSec: number;
  /** Sample id, `all` or `custom`. */
  source: string;
  customCode: string;
  mode: CompareOptions['mode'];
  comments: CompareOptions['comments'];
  custom: WhitespaceRules;
  errorPolicy: ErrorPolicy;
  autoIndent: boolean;
  idleSec: number;
}

export const DURATIONS = [15, 30, 60, 120];
export const IDLE_OPTIONS = [0, 5, 10, 30];

export const DEFAULT_SETTINGS: PracticeSettings = {
  testType: 'full',
  durationSec: 60,
  source: SAMPLES[0].id,
  customCode: '',
  mode: 'tolerant',
  comments: 'omit',
  custom: { indentation: 'ignore', inlineSpaces: 'collapse', lineBreaks: 'exact', blankLines: 'ignore' },
  errorPolicy: 'advance',
  autoIndent: true,
  idleSec: 10,
};

export function sourcesFor(s: PracticeSettings): string[] {
  if (s.source === 'custom') return s.customCode.trim() ? [s.customCode] : [];
  if (s.source === 'all') return SAMPLES.map((x) => x.code);
  const sample = SAMPLES.find((x) => x.id === s.source);
  return sample ? [sample.code] : [];
}

/** First text of a test and, for timed tests, a generator of further texts. */
export function textsFor(
  s: PracticeSettings,
  rand: () => number = Math.random,
  /** Text just practiced; a different one is chosen when possible. */
  previous?: string,
): { first: string; next?: () => string } {
  const sources = sourcesFor(s);
  if (sources.length === 0) return { first: '' };
  if (s.testType === 'snippet') return { first: pickSnippet(sources, rand, DEFAULT_SNIPPET_OPTIONS, 'cpp', previous) };
  if (s.testType === 'timed') {
    let last = previous;
    const next = () => (last = pickSnippet(sources, rand, DEFAULT_SNIPPET_OPTIONS, 'cpp', last));
    return { first: next(), next };
  }
  const fresh = sources.length > 1 ? sources.filter((x) => x !== previous) : sources;
  return { first: fresh[Math.floor(rand() * fresh.length)] };
}

export function sessionConfig(s: PracticeSettings, next?: () => string): SessionConfig {
  return {
    compare: { mode: s.mode, comments: s.comments, custom: s.custom },
    language: 'cpp',
    errorPolicy: s.errorPolicy,
    timeLimitMs: s.testType === 'timed' ? s.durationSec * 1000 : undefined,
    nextText: next,
    autoIndent: s.autoIndent,
    idleTimeoutMs: s.idleSec * 1000,
  };
}

/** What gets stored with the result so that tests can be filtered and compared. */
export function metaFor(s: PracticeSettings, names: { all: string; custom: string }): TestMeta {
  const sample = SAMPLES.find((x) => x.id === s.source);
  return {
    testType: s.testType,
    sourceId: s.source,
    sourceName: sample?.name ?? (s.source === 'all' ? names.all : names.custom),
    language: 'cpp',
    mode: s.mode,
    comments: s.comments,
    errorPolicy: s.errorPolicy,
    timeLimitMs: s.testType === 'timed' ? s.durationSec * 1000 : undefined,
  };
}
