import { buildTarget, Evaluator, type ErrorKind, type KeystrokeResult, type Target } from '../engine';
import type { FinishReason, KeystrokeLog, PauseReason, SessionConfig, SessionSnapshot, SessionStatus } from './types';

const CHARS_PER_WORD = 5;
const isWs = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n';

interface TextStats {
  correct: number;
  total: number;
  uncorrected: number;
  tokensTotal: number;
  tokensCorrect: number;
}

/** Result of feeding input to the session. */
export interface InputResult {
  /** Characters applied to the text. */
  accepted: number;
  /** Characters rejected (block policy). */
  rejected: number;
  /** Characters ignored because the session was finished. */
  ignored: number;
}

/**
 * A typing test over one text (or a chain of texts in timed tests).
 *
 * The session owns the clock, the error policy, undo groups and the keystroke
 * log; character comparison is delegated to the engine `Evaluator`. It has no
 * DOM dependency: the UI only translates key events into `input`/`backspace`.
 */
export class TypingSession {
  readonly config: SessionConfig;
  target: Target;
  evaluator: Evaluator;
  readonly log: KeystrokeLog[] = [];
  /** Every text of the session, in order (timed tests chain several). */
  readonly texts: string[] = [];

  private now: () => number;
  private _status: SessionStatus = 'ready';
  private _pauseReason?: PauseReason;
  private _finishReason?: FinishReason;
  private startAt = 0;
  private pausedAt = 0;
  private pausedTotal = 0;
  private endAt = 0;
  private lastActivity = 0;
  /** Number of evaluator pushes per user action, so backspace undoes a whole action (e.g. Enter + auto-indent). */
  private groups: number[] = [];
  private segment = 0;
  private finishedTexts: TextStats[] = [];
  private counters = { typed: 0, correct: 0, errors: 0, corrections: 0 };
  private errorsByKind: Partial<Record<ErrorKind, number>> = {};
  /** Precomputed: for each token index, the item indexes of its first and last characters. */
  private tokenRanges = new Map<number, [number, number]>();
  /** Incremented on every change; lets UIs detect updates cheaply. */
  version = 0;
  private listeners = new Set<() => void>();

  constructor(text: string, config: SessionConfig) {
    this.config = config;
    this.now = config.now ?? (() => performance.now());
    this.texts.push(text);
    this.target = buildTarget(text, config.language, config.compare);
    this.evaluator = new Evaluator(this.target);
    this.indexTokens();
  }

  get status(): SessionStatus {
    return this._status;
  }

  get segmentIndex(): number {
    return this.segment;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Feeds typed characters (one key press or a burst of several). */
  input(text: string): InputResult {
    const res: InputResult = { accepted: 0, rejected: 0, ignored: 0 };
    if (!text) return res;
    for (const raw of text) {
      const ch = raw === '\r' ? '\n' : raw;
      if (!this.beginAction()) {
        res.ignored++;
        continue;
      }
      if (this.typeChar(ch)) res.accepted++;
      else res.rejected++;
      this.afterAction();
    }
    this.emit();
    return res;
  }

  /** Tab: types the indentation expected at the cursor, or a tab character. */
  tab(): InputResult {
    const items = this.target.items;
    const item = items[this.evaluator.pos];
    if (!item || item.kind !== 'char' || (item.ch !== ' ' && item.ch !== '\t')) return this.input('\t');
    if (!this.beginAction()) return { accepted: 0, rejected: 0, ignored: 1 };
    let pushed = 0;
    while (true) {
      const it = items[this.evaluator.pos];
      if (!it || it.kind !== 'char' || (it.ch !== ' ' && it.ch !== '\t')) break;
      this.record('char', it.ch, this.evaluator.push(it.ch), pushed > 0);
      pushed++;
    }
    this.groups.push(pushed);
    this.afterAction();
    this.emit();
    return { accepted: pushed, rejected: 0, ignored: 0 };
  }

  /** Undoes the last action. Returns false when there is nothing to undo. */
  backspace(): boolean {
    const ok = this.undoOne('backspace');
    this.emit();
    return ok;
  }

  /** Ctrl+Backspace: undoes back to the start of the current (or previous) token. */
  wordBackspace(): boolean {
    if (this._status === 'finished' || this.groups.length === 0) return false;
    const items = this.target.items;
    const tokenAt = (pos: number) => {
      const it = items[pos];
      return it && it.kind === 'char' ? it.token : -2;
    };
    // Skip whitespace and gaps, then remove characters of a single token.
    while (this.groups.length && tokenAt(this.evaluator.pos - 1) < 0 && this.evaluator.extras[this.evaluator.pos] === 0) {
      if (!this.undoOne('wordBackspace', true)) break;
    }
    const token = tokenAt(this.evaluator.pos - 1);
    while (this.groups.length) {
      if (this.evaluator.extras[this.evaluator.pos] > 0) {
        this.undoOne('wordBackspace', true);
        continue;
      }
      if (token < 0 || tokenAt(this.evaluator.pos - 1) !== token) break;
      this.undoOne('wordBackspace', true);
    }
    this.counters.corrections++;
    this.emit();
    return true;
  }

  pause(reason: PauseReason = 'user'): void {
    if (this._status !== 'running') return;
    this._status = 'paused';
    this._pauseReason = reason;
    this.pausedAt = reason === 'idle' ? this.lastActivity : this.now();
    this.emit();
  }

  resume(): void {
    if (this._status !== 'paused') return;
    this.pausedTotal += this.now() - this.pausedAt;
    this._status = 'running';
    this._pauseReason = undefined;
    this.lastActivity = this.now();
    this.emit();
  }

  togglePause(): void {
    if (this._status === 'running') this.pause('user');
    else if (this._status === 'paused') this.resume();
  }

  /** Ends the session early. */
  abort(): void {
    if (this._status === 'finished') return;
    this.finish('aborted');
    this.emit();
  }

  /** Called periodically by the UI: detects time-up and inactivity. */
  tick(): void {
    if (this._status !== 'running') return;
    if (this.checkTimeUp()) return this.emit();
    const idle = this.config.idleTimeoutMs;
    if (idle > 0 && this.now() - this.lastActivity >= idle) this.pause('idle');
  }

  /** Active time in ms. */
  elapsed(): number {
    switch (this._status) {
      case 'ready':
        return 0;
      case 'paused':
        return this.pausedAt - this.startAt - this.pausedTotal;
      case 'finished':
        return this.endAt - this.startAt - this.pausedTotal;
      default:
        return this.now() - this.startAt - this.pausedTotal;
    }
  }

  private tokenStats(): { done: number; correct: number } {
    const ev = this.evaluator;
    const items = this.target.items;
    let done = 0;
    let correct = 0;
    for (const [first, last] of this.tokenRanges.values()) {
      if (last >= ev.pos) continue;
      done++;
      let ok = true;
      for (let i = first; i <= last && ok; i++) if (items[i].kind === 'char' && ev.states[i] !== 'correct') ok = false;
      if (ok) correct++;
    }
    return { done, correct };
  }

  snapshot(): SessionSnapshot {
    const ev = this.evaluator;
    const counts = ev.getCounts();
    const elapsedMs = Math.max(0, this.elapsed());
    const minutes = elapsedMs / 60000;

    const { done: tokensDone, correct: tokensCorrect } = this.tokenStats();
    const prev = this.finishedTexts.reduce(
      (a, x) => ({ uncorrected: a.uncorrected + x.uncorrected, tokensTotal: a.tokensTotal + x.tokensTotal, tokensCorrect: a.tokensCorrect + x.tokensCorrect }),
      { uncorrected: 0, tokensTotal: 0, tokensCorrect: 0 },
    );

    const caret = this.caretOffset();
    const text = this.target.text;
    let line = 1;
    for (let i = 0; i < caret && i < text.length; i++) if (text[i] === '\n') line++;
    const lines = text.length === 0 ? 1 : text.split('\n').length;

    const doneChars = counts.total - counts.remaining;
    const sessionCorrect = this.finishedTexts.reduce((a, s) => a + s.correct, 0) + counts.correct;
    const evaluated = this.counters.correct + this.counters.errors;
    const timeLimit = this.config.timeLimitMs;
    return {
      status: this._status,
      pauseReason: this._pauseReason,
      finishReason: this._finishReason,
      elapsedMs,
      remainingMs: timeLimit ? Math.max(0, timeLimit - elapsedMs) : undefined,
      totalChars: counts.total,
      doneChars,
      correctChars: counts.correct,
      progress: counts.total === 0 ? (ev.complete ? 1 : 0) : doneChars / counts.total,
      tokensTotal: this.tokenRanges.size,
      tokensDone,
      tokensCorrect,
      line,
      lines,
      wpm: minutes > 0 ? sessionCorrect / CHARS_PER_WORD / minutes : 0,
      rawWpm: minutes > 0 ? this.counters.typed / CHARS_PER_WORD / minutes : 0,
      accuracy: evaluated === 0 ? 1 : this.counters.correct / evaluated,
      errorsMade: this.counters.errors,
      uncorrected: prev.uncorrected + counts.incorrect + counts.missed + counts.extra,
      errorsByKind: { ...this.errorsByKind },
      corrections: this.counters.corrections,
      textsCompleted: this.finishedTexts.length,
      sessionCorrectChars: sessionCorrect,
      sessionTokensTotal: prev.tokensTotal + this.tokenRanges.size,
      sessionTokensCorrect: prev.tokensCorrect + tokensCorrect,
    };
  }

  /** Offset in `target.text` where the cursor is drawn. */
  caretOffset(): number {
    const ev = this.evaluator;
    const item = this.target.items[ev.pos];
    if (!item) return this.target.text.length;
    if (item.kind === 'gap') return Math.min(item.src + ev.gapTyped, item.srcEnd);
    return item.src;
  }

  // ---------------------------------------------------------------------------

  /** Starts/resumes the clock and checks the limits; false if input must be ignored. */
  private beginAction(): boolean {
    if (this._status === 'finished') return false;
    const now = this.now();
    if (this._status === 'ready') {
      this._status = 'running';
      this.startAt = now;
      this.lastActivity = now;
    } else if (this._status === 'paused') {
      this.resume();
    } else if (this.config.idleTimeoutMs > 0 && now - this.lastActivity >= this.config.idleTimeoutMs) {
      // Inactivity that was not caught by tick(): exclude it retroactively.
      this.pausedTotal += now - this.lastActivity;
    }
    if (this.checkTimeUp()) return false;
    this.lastActivity = now;
    return true;
  }

  private afterAction(): void {
    if (this._status !== 'running') return;
    if (!this.evaluator.complete || !this.lastCharCorrect()) return;
    if (this.config.timeLimitMs && this.config.nextText) this.nextSegment();
    else this.finish('completed');
  }

  private typeChar(ch: string): boolean {
    const ev = this.evaluator;
    if (this.config.errorPolicy === 'block') {
      const preview = ev.peek(ch);
      if (preview.status === 'error') {
        this.record('char', ch, preview, false, true);
        return false;
      }
    }
    const result = ev.push(ch);
    this.record('char', ch, result);
    let pushed = 1;
    if (ch === '\n' && result.status !== 'error' && this.config.autoIndent) {
      const items = this.target.items;
      while (true) {
        const it = items[ev.pos];
        if (!it || it.kind !== 'char' || (it.ch !== ' ' && it.ch !== '\t')) break;
        this.record('char', it.ch, ev.push(it.ch), true);
        pushed++;
      }
    }
    this.groups.push(pushed);
    return true;
  }

  private undoOne(kind: 'backspace' | 'wordBackspace', silent = false): boolean {
    if (this._status === 'finished') return false;
    const n = this.groups.pop();
    if (n === undefined) return false;
    if (this._status === 'paused') this.resume();
    for (let i = 0; i < n; i++) this.evaluator.pop();
    if (!silent) this.counters.corrections++;
    this.log.push({ t: this.elapsed(), kind, status: 'undo', segment: this.segment });
    this.lastActivity = this.now();
    return true;
  }

  private record(kind: 'char', ch: string, r: KeystrokeResult, auto = false, rejected = false) {
    const item = this.target.items[r.item];
    this.log.push({
      t: this.elapsed(),
      kind,
      ch,
      status: rejected ? 'rejected' : r.status,
      error: r.error,
      expected: item?.kind === 'char' && (r.status === 'correct' || r.error === 'substitution') ? item.ch : undefined,
      // Whitespace mistakes (missing separator, forbidden space…) belong to the gap, not to the neighbouring token.
      tokenType: r.error && r.error !== 'substitution' && r.error !== 'insertion' ? 'whitespace' : item ? (item.kind === 'char' ? item.tokenType : 'whitespace') : undefined,
      auto: auto || undefined,
      segment: this.segment,
    });
    if (auto) return;
    if (!rejected) this.counters.typed++;
    if (r.status === 'error') {
      this.counters.errors++;
      if (r.error) this.errorsByKind[r.error] = (this.errorsByKind[r.error] ?? 0) + 1;
    } else if (r.status === 'correct' || (r.status === 'free' && isWs(ch))) {
      this.counters.correct++;
    }
  }

  private lastCharCorrect(): boolean {
    const items = this.target.items;
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].kind === 'char') return this.evaluator.states[i] === 'correct';
    }
    return true;
  }

  private checkTimeUp(): boolean {
    const limit = this.config.timeLimitMs;
    if (!limit || this._status !== 'running') return false;
    if (this.now() - this.startAt - this.pausedTotal < limit) return false;
    this.finish('timeUp', this.startAt + this.pausedTotal + limit);
    return true;
  }

  private finish(reason: FinishReason, at = this.now()) {
    if (this._status === 'paused') {
      this.pausedTotal += this.now() - this.pausedAt;
      at = Math.min(at, this.now());
    }
    this._status = 'finished';
    this._finishReason = reason;
    this._pauseReason = undefined;
    this.endAt = at;
  }

  private nextSegment() {
    const counts = this.evaluator.getCounts();
    const tokens = this.tokenStats();
    this.finishedTexts.push({
      correct: counts.correct,
      total: counts.total,
      uncorrected: counts.incorrect + counts.missed + counts.extra,
      tokensTotal: this.tokenRanges.size,
      tokensCorrect: tokens.correct,
    });
    this.segment++;
    const text = this.config.nextText!();
    this.texts.push(text);
    this.target = buildTarget(text, this.config.language, this.config.compare);
    this.evaluator = new Evaluator(this.target);
    this.groups = [];
    this.indexTokens();
  }

  private indexTokens() {
    this.tokenRanges.clear();
    this.target.items.forEach((it, i) => {
      if (it.kind !== 'char' || it.token < 0) return;
      const range = this.tokenRanges.get(it.token);
      if (range) range[1] = i;
      else this.tokenRanges.set(it.token, [i, i]);
    });
  }

  private emit() {
    this.version++;
    for (const l of this.listeners) l();
  }
}
