import type { ErrorKind, GapItem, ItemState, KeystrokeResult, Target } from './types';

const isWhitespace = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v';

interface Undo {
  pos: number;
  gapCount: number;
  gapNewline: boolean;
  states: Array<[number, ItemState]>;
  extraAt: number;
}

export interface EvaluationCounts {
  /** Characters that must be typed. */
  total: number;
  correct: number;
  incorrect: number;
  /** Whitespace that was required (separator, line break, exact formatting) but omitted. */
  missed: number;
  /** Extra characters typed where nothing was expected. */
  extra: number;
  /** Characters not yet reached. */
  remaining: number;
}

/**
 * Incremental, undoable evaluator. `push` processes one typed character and
 * `pop` undoes the last one (backspace). The result is identical to evaluating
 * the whole typed text from scratch.
 */
export class Evaluator {
  readonly target: Target;
  /** Index of the next item to type. */
  pos = 0;
  readonly states: ItemState[];
  /** Number of extra (inserted) characters before each item; index `items.length` = after the end. */
  readonly extras: number[];
  private gapCount = 0;
  private gapNewline = false;
  private history: Undo[] = [];
  private current: Undo | null = null;
  private counts = { correct: 0, incorrect: 0, missed: 0, extra: 0 };

  constructor(target: Target) {
    this.target = target;
    this.states = target.items.map(() => 'pending');
    this.extras = new Array(target.items.length + 1).fill(0);
  }

  get typedLength(): number {
    return this.history.length;
  }

  /** Whitespace characters typed so far in the gap at `pos` (when it is a gap). */
  get gapTyped(): number {
    return this.gapCount;
  }

  push(ch: string): KeystrokeResult {
    this.current = { pos: this.pos, gapCount: this.gapCount, gapNewline: this.gapNewline, states: [], extraAt: -1 };
    const result = this.process(ch);
    this.history.push(this.current);
    this.current = null;
    return result;
  }

  pop(): boolean {
    const undo = this.history.pop();
    if (!undo) return false;
    for (let k = undo.states.length - 1; k >= 0; k--) {
      const [idx, prev] = undo.states[k];
      this.setState(idx, prev, false);
    }
    if (undo.extraAt >= 0) {
      this.extras[undo.extraAt]--;
      this.counts.extra--;
    }
    this.pos = undo.pos;
    this.gapCount = undo.gapCount;
    this.gapNewline = undo.gapNewline;
    return true;
  }

  /** Result that typing `ch` would produce, without changing the state. */
  peek(ch: string): KeystrokeResult {
    const r = this.push(ch);
    this.pop();
    return r;
  }

  get complete(): boolean {
    const items = this.target.items;
    for (let i = this.pos; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'char') return false;
      if (i === this.pos ? !this.gapSatisfied(it) : it.min > 0 || it.requireNewline) return false;
    }
    return true;
  }

  getCounts(): EvaluationCounts {
    const total = this.target.charCount;
    const { correct, incorrect, missed, extra } = this.counts;
    let remaining = 0;
    this.target.items.forEach((it, i) => {
      if (it.kind === 'char' && this.states[i] === 'pending') remaining++;
    });
    return { total, correct, incorrect, missed, extra, remaining };
  }

  private process(ch: string): KeystrokeResult {
    const items = this.target.items;
    const ws = isWhitespace(ch);
    for (;;) {
      if (this.pos >= items.length) return this.insert(ch === '\n' ? 'unexpectedNewline' : 'insertion');
      const item = items[this.pos];

      if (item.kind === 'gap') {
        if (ws) {
          if (item.max === 0) return this.insert('forbiddenWhitespace');
          const nl = ch === '\n';
          if ((nl ? item.newlines : item.spaces) && this.gapCount < item.max) {
            this.gapCount++;
            if (nl) this.gapNewline = true;
            return { status: 'free', item: this.pos };
          }
          if (this.gapSatisfied(item)) {
            this.leaveGap('satisfied');
            continue;
          }
          return this.insert(nl ? 'unexpectedNewline' : 'insertion');
        }
        if (this.gapSatisfied(item)) {
          this.leaveGap('satisfied');
          continue;
        }
        const kind: ErrorKind =
          item.requireNewline && !this.gapNewline ? 'missingNewline' : item.reason === 'separator' ? 'missingSeparator' : 'missingWhitespace';
        this.leaveGap('missed');
        return this.matchAfterMissing(ch, kind);
      }

      if (ch === item.ch) {
        this.setState(this.pos, 'correct');
        this.pos++;
        return { status: 'correct', item: this.pos - 1 };
      }
      if (ws && !isWhitespace(item.ch)) return this.insert(ch === '\n' ? 'unexpectedNewline' : 'insertion');
      if (!ws && isWhitespace(item.ch)) {
        // Required formatting whitespace was skipped: mark it and keep in sync.
        const kind: ErrorKind = item.ch === '\n' ? 'missingNewline' : 'missingWhitespace';
        while (this.pos < items.length) {
          const it = items[this.pos];
          if (it.kind === 'char' && !isWhitespace(it.ch)) break;
          if (it.kind === 'gap') {
            this.leaveGap('missed');
            continue;
          }
          this.setState(this.pos, 'missed');
          this.pos++;
        }
        return this.matchAfterMissing(ch, kind);
      }
      this.setState(this.pos, 'incorrect');
      this.pos++;
      return { status: 'error', item: this.pos - 1, error: 'substitution' };
    }
  }

  /** After skipping missing whitespace, the typed character is compared with the next item. */
  private matchAfterMissing(ch: string, kind: ErrorKind): KeystrokeResult {
    const items = this.target.items;
    if (this.pos >= items.length) {
      this.addExtra();
      return { status: 'error', item: items.length, error: kind };
    }
    const item = items[this.pos];
    if (item.kind === 'char') {
      this.setState(this.pos, ch === item.ch ? 'correct' : 'incorrect');
      this.pos++;
      return { status: 'error', item: this.pos - 1, error: kind };
    }
    return { status: 'error', item: this.pos, error: kind };
  }

  private gapSatisfied(gap: GapItem): boolean {
    return this.gapCount >= gap.min && (!gap.requireNewline || this.gapNewline);
  }

  private leaveGap(state: ItemState) {
    this.setState(this.pos, state);
    this.pos++;
    this.gapCount = 0;
    this.gapNewline = false;
  }

  private insert(kind: ErrorKind): KeystrokeResult {
    this.addExtra();
    return { status: 'error', item: this.pos, error: kind };
  }

  private addExtra() {
    this.extras[this.pos]++;
    this.counts.extra++;
    if (this.current) this.current.extraAt = this.pos;
  }

  private setState(idx: number, state: ItemState, record = true) {
    const prev = this.states[idx];
    if (prev === state) return;
    if (record && this.current) this.current.states.push([idx, prev]);
    this.bump(idx, prev, -1);
    this.states[idx] = state;
    this.bump(idx, state, 1);
  }

  private bump(idx: number, state: ItemState, delta: number) {
    const isChar = this.target.items[idx].kind === 'char';
    if (state === 'correct' && isChar) this.counts.correct += delta;
    else if (state === 'incorrect') this.counts.incorrect += delta;
    else if (state === 'missed') this.counts.missed += delta;
  }
}

export interface Evaluation {
  states: ItemState[];
  extras: number[];
  pos: number;
  results: KeystrokeResult[];
  complete: boolean;
  counts: EvaluationCounts;
  errors: number;
}

/** Evaluates a whole typed text against the target (pure function). */
export function evaluate(target: Target, typed: string): Evaluation {
  const ev = new Evaluator(target);
  const results: KeystrokeResult[] = [];
  for (const ch of typed) results.push(ev.push(ch));
  return {
    states: [...ev.states],
    extras: [...ev.extras],
    pos: ev.pos,
    results,
    complete: ev.complete,
    counts: ev.getCounts(),
    errors: results.filter((r) => r.status === 'error').length,
  };
}
