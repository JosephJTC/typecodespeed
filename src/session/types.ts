import type { CompareOptions, ErrorKind, TokenType } from '../engine';

/** What happens when a wrong key is pressed. */
export type ErrorPolicy =
  /** The keystroke is recorded as an error and the cursor advances (it can be fixed with backspace). */
  | 'advance'
  /** The keystroke is rejected: the cursor does not move until the correct key is pressed. */
  | 'block';

export type SessionStatus = 'ready' | 'running' | 'paused' | 'finished';
export type PauseReason = 'user' | 'idle' | 'blur';
export type FinishReason = 'completed' | 'timeUp' | 'aborted';

export interface SessionConfig {
  compare: CompareOptions;
  language: string;
  errorPolicy: ErrorPolicy;
  /** Timed test: the session ends when this many milliseconds of active time have elapsed. */
  timeLimitMs?: number;
  /** Timed test: supplies the next text when the current one is completed before the time is up. */
  nextText?: () => string;
  /** After an accepted line break, type the indentation of the line, as an editor does. */
  autoIndent: boolean;
  /**
   * Editor-style bracket pairs: typing `(`, `[` or `{` (outside strings and comments)
   * inserts its closing bracket after the cursor; typing that bracket types over it.
   */
  autoClose?: boolean;
  /** Once the user starts typing a text, the pending reference code is no longer drawn (see `display`). */
  hideGuide?: boolean;
  /** Pauses the clock after this much inactivity (the idle time is not counted). 0 disables it. */
  idleTimeoutMs: number;
  /** Clock in milliseconds; injectable for tests. */
  now?: () => number;
}

export type KeystrokeKind = 'char' | 'backspace' | 'wordBackspace' | 'delete' | 'wordDelete';

export interface KeystrokeLog {
  /** Active time (ms since the start, pauses excluded). */
  t: number;
  kind: KeystrokeKind;
  ch?: string;
  status: 'correct' | 'error' | 'free' | 'rejected' | 'undo';
  error?: ErrorKind;
  /** Character the engine expected at that point (absent for whitespace gaps and extra characters). */
  expected?: string;
  /** Type of the token the keystroke belongs to (`whitespace` for gaps between tokens). */
  tokenType?: TokenType;
  /** Inserted automatically (auto-indentation), not typed by the user. */
  auto?: boolean;
  segment: number;
}

export interface SessionSnapshot {
  status: SessionStatus;
  pauseReason?: PauseReason;
  finishReason?: FinishReason;
  /** Active time in ms (pauses excluded). */
  elapsedMs: number;
  /** Timed tests only. */
  remainingMs?: number;
  /** Characters to type in the current text. */
  totalChars: number;
  /** Characters of the current text already reached (correct + incorrect + missed whitespace). */
  doneChars: number;
  correctChars: number;
  /** 0..1, progress through the current text. */
  progress: number;
  tokensTotal: number;
  /** Tokens fully passed by the cursor. */
  tokensDone: number;
  /** Tokens passed with every character correct. */
  tokensCorrect: number;
  /** 1-based line of the cursor in the current text. */
  line: number;
  lines: number;
  /** Net words per minute: correct characters / 5 per minute (all texts of the session). */
  wpm: number;
  /** Gross words per minute: every typed character / 5 per minute. */
  rawWpm: number;
  /** Correct keystrokes / keystrokes that were evaluated (0..1); corrected mistakes still count. */
  accuracy: number;
  /** Error keystrokes made, including the ones that were later corrected or rejected. */
  errorsMade: number;
  /** Errors still present in the current text (incorrect, missed whitespace, extra characters). */
  uncorrected: number;
  errorsByKind: Partial<Record<ErrorKind, number>>;
  /** Backspace presses. */
  corrections: number;
  /** Texts completed during a timed test. */
  textsCompleted: number;
  /** Characters typed correctly in all the session's texts. */
  sessionCorrectChars: number;
  /** Tokens of every text of the session (timed tests chain several texts). */
  sessionTokensTotal: number;
  sessionTokensCorrect: number;
}
