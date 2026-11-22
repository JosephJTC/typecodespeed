import type { CompareOptions, WhitespaceRules } from '../../engine';
import type { ErrorPolicy, SessionConfig } from '../../session';
import { pickSnippet, SAMPLES } from '../../snippets';

export type TestType = 'full' | 'timed' | 'snippet';

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
export function textsFor(s: PracticeSettings, rand: () => number = Math.random): { first: string; next?: () => string } {
  const sources = sourcesFor(s);
  if (sources.length === 0) return { first: '' };
  if (s.testType === 'snippet') return { first: pickSnippet(sources, rand) };
  if (s.testType === 'timed') {
    const next = () => pickSnippet(sources, rand);
    return { first: next(), next };
  }
  return { first: sources[Math.floor(rand() * sources.length)] };
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
