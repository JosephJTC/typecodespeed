import type { ComparisonMode, ErrorKind, TokenType } from '../engine';
import type { ErrorPolicy, FinishReason } from '../session';

export const RECORD_VERSION = 1;

export type TestType = 'full' | 'timed' | 'snippet';

/** Attempts, mistakes and time spent on one kind of key (a character, a token type, a character class). */
export interface KeyStat {
  attempts: number;
  errors: number;
  /** Sum of the delays before each timed attempt, in ms. */
  timeMs: number;
  /** Attempts that have a measured delay. */
  timed: number;
}

export type CharClass = 'letter' | 'digit' | 'symbol' | 'whitespace';

/** One interval of the test timeline. */
export interface Bucket {
  /** Start of the interval, in ms of active time. */
  t: number;
  /** Length of the interval in ms (the last one may be shorter). */
  ms: number;
  /** Correct keystrokes in the interval. */
  correct: number;
  /** Wrong (or rejected) keystrokes. */
  errors: number;
  /** All keystrokes that produced a character. */
  typed: number;
  /** Backspaces. */
  corrections: number;
}

/** What the test was, so that results can be filtered and compared. */
export interface TestMeta {
  testType: TestType;
  /** Display name of the code that was practiced. */
  sourceName: string;
  sourceId: string;
  language: string;
  mode: ComparisonMode;
  comments: 'include' | 'omit';
  errorPolicy: ErrorPolicy;
  timeLimitMs?: number;
}

/** Everything stored about a finished test. Computed from the recorded keystroke log. */
export interface TestRecord extends TestMeta {
  version: number;
  id: string;
  /** Wall-clock time when the test ended (ms since the epoch). */
  finishedAt: number;
  finishReason: FinishReason;
  /** Hash of the practiced text(s); equal hashes mean the same code. */
  textHash: string;

  durationMs: number;
  /** Net speed: correct characters still standing at the end / 5 per minute. */
  wpm: number;
  /** Every typed character / 5 per minute. */
  rawWpm: number;
  /** Correct characters per second. */
  cps: number;
  /** Correct keystrokes / evaluated keystrokes (corrected mistakes still count). */
  accuracy: number;
  /** 0..1: fraction of the text (or of the time limit) that was completed. */
  completion: number;
  /** 0..1: how steady the speed was (1 = perfectly steady). */
  consistency: number;

  correctChars: number;
  totalChars: number;
  keystrokes: number;
  /** Keystrokes judged right or wrong (the denominator of `accuracy`). */
  evaluated: number;
  errorsMade: number;
  uncorrected: number;
  corrections: number;
  textsCompleted: number;
  tokensTotal: number;
  tokensCorrect: number;
  lines: number;

  errorsByKind: Partial<Record<ErrorKind, number>>;
  /** Keyed by the expected character. */
  chars: Record<string, KeyStat>;
  tokenTypes: Partial<Record<TokenType, KeyStat>>;
  charClasses: Partial<Record<CharClass, KeyStat>>;
  /** Most frequent substitutions: `expected` was wanted, `typed` was pressed. */
  confusions: Array<{ expected: string; typed: string; count: number }>;

  bucketMs: number;
  buckets: Bucket[];
}
