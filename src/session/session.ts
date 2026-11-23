import { buildDisplay, buildTarget, closerOfOpener, Evaluator, type Display, type ErrorKind, type KeystrokeResult, type PendingChar, type Target, type TokenType } from '../engine';
import { CLOSER_OF, closesBefore, EditorBuffer, inLiteral, isCloser, isOpener, openerOf, type Motion } from '../editor';
import type { FinishReason, KeystrokeLog, PauseReason, SessionConfig, SessionSnapshot, SessionStatus } from './types';

const CHARS_PER_WORD = 5;
const isWs = (ch: string) => ch === ' ' || ch === '\t' || ch === '\n';
const isIndent = (ch: string) => ch === ' ' || ch === '\t';
const INDENT_UNIT = '    ';
const LITERAL_TOKENS: ReadonlySet<TokenType> = new Set<TokenType>(['string', 'char', 'comment', 'header']);

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
 * The session owns the clock, the error policy, the edited text (an
 * `EditorBuffer` with cursor and selection) and the keystroke log. The engine
 * `Evaluator` always holds the edited text up to the closing brackets the
 * editor inserted ahead of the user, which are not evaluated until the user
 * types over them or past them. It has no DOM dependency: the UI only
 * translates key events into session calls.
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
  /** The text being typed, with cursor and selection. */
  readonly editor = new EditorBuffer();
  /** Engine result of every evaluated character of `editor` (same order as the evaluator history). */
  private results: KeystrokeResult[] = [];
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

  /** Tab: at the end of the text, types the indentation expected there; otherwise a tab character. */
  tab(): InputResult {
    const items = this.target.items;
    const isWsItem = (i: number) => {
      const it = items[i];
      return it?.kind === 'char' && isIndent(it.ch);
    };
    if (!this.atFrontier() || !isWsItem(this.evaluator.pos)) return this.input('\t');
    if (!this.beginAction()) return { accepted: 0, rejected: 0, ignored: 1 };
    let n = 0;
    while (isWsItem(this.evaluator.pos)) {
      const ch = (items[this.evaluator.pos] as { ch: string }).ch;
      this.editor.insert(ch, n > 0);
      this.sync();
      this.record('char', ch, this.results[this.editor.cursor - 1], n > 0);
      n++;
    }
    this.afterAction();
    this.emit();
    return { accepted: n, rejected: 0, ignored: 0 };
  }

  /**
   * Deletes the selection or the character before the cursor. Inside an empty
   * pair whose closing bracket the editor inserted, deletes both; right after
   * an automatic indentation, deletes it together with its line break.
   */
  backspace(): boolean {
    return this.edit('backspace', () => {
      const ed = this.editor;
      if (ed.deleteSelection()) return true;
      const c = ed.cursor;
      if (c === 0) return false;
      const prev = ed.cells[c - 1];
      const next = ed.cells[c];
      if (next?.ahead && isOpener(prev.ch) && next.ch === CLOSER_OF[prev.ch]) {
        ed.delete(c - 1, c + 1);
        return true;
      }
      let j = c;
      while (j > 0 && ed.cells[j - 1].auto && !ed.cells[j - 1].ahead && isIndent(ed.cells[j - 1].ch)) j--;
      ed.delete(j < c && j > 0 && ed.cells[j - 1].ch === '\n' ? j - 1 : c - 1, c);
      // Undo the split of `{|}` made by Enter.
      const at = ed.cursor;
      const before = ed.cells[at - 1]?.ch;
      if (isOpener(before) && ed.cells[at]?.ahead && ed.cells[at].ch === '\n') {
        const k = this.aheadCloser(CLOSER_OF[before]);
        if (k >= 0) ed.delete(at, k);
      }
      return true;
    });
  }

  /** Ctrl+Backspace: deletes the selection or back to the start of the previous word or symbol run. */
  wordBackspace(): boolean {
    return this.edit('wordBackspace', () => {
      const ed = this.editor;
      if (ed.deleteSelection()) return true;
      if (ed.cursor === 0) return false;
      ed.delete(ed.wordLeft(ed.cursor), ed.cursor);
      return true;
    });
  }

  /** Delete: deletes the selection or the character after the cursor. */
  deleteForward(): boolean {
    return this.edit('delete', () => {
      const ed = this.editor;
      if (ed.deleteSelection()) return true;
      if (ed.cursor >= ed.length) return false;
      ed.delete(ed.cursor, ed.cursor + 1);
      return true;
    });
  }

  /** Ctrl+Delete: deletes the selection or up to the end of the next word or symbol run. */
  wordDelete(): boolean {
    return this.edit('wordDelete', () => {
      const ed = this.editor;
      if (ed.deleteSelection()) return true;
      if (ed.cursor >= ed.length) return false;
      ed.delete(ed.cursor, ed.wordRight(ed.cursor));
      return true;
    });
  }

  /** Moves the cursor (extending the selection with Shift). Does not start the clock. */
  move(motion: Motion, extend = false): void {
    if (this._status === 'finished') return;
    this.editor.move(motion, extend);
    this.emit();
  }

  selectAll(): void {
    if (this._status === 'finished') return;
    this.editor.selectAll();
    this.emit();
  }

  /** What to draw: the edited text, the inserted brackets and the pending code, with cursor and selection. */
  display(): Display {
    const ed = this.editor;
    return buildDisplay(this.evaluator, { pending: this.pendingChars(), cursor: ed.cursor, anchor: ed.anchor });
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
    const sessionCorrect = this.finishedTexts.reduce((a, s) => a + s.correct, 0) + this.typedCorrect();
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

  /** Offset of the first character inserted ahead of the user (not evaluated yet). */
  private pendingStart(): number {
    const cells = this.editor.cells;
    let i = cells.length;
    while (i > 0 && cells[i - 1].ahead) i--;
    return i;
  }

  /** Offset of the inserted closing bracket `ch` right after the cursor (past inserted line breaks), or -1. */
  private aheadCloser(ch: string): number {
    const cells = this.editor.cells;
    let j = this.editor.cursor;
    while (cells[j]?.ahead && isWs(cells[j].ch)) j++;
    return cells[j]?.ahead && cells[j].ch === ch ? j : -1;
  }

  /**
   * Offset of the inserted closing bracket that follows the cursor on its own
   * line when the reference expects that bracket next (only whitespace in
   * between), or -1.
   */
  private blockEnd(): number {
    const ed = this.editor;
    const cells = ed.cells;
    if (ed.cursor !== this.pendingStart() || !(cells[ed.cursor]?.ahead && cells[ed.cursor].ch === '\n')) return -1;
    let k = ed.cursor;
    while (cells[k]?.ahead && isWs(cells[k].ch)) k++;
    if (!(cells[k]?.ahead && isCloser(cells[k].ch))) return -1;
    const items = this.target.items;
    let i = this.evaluator.pos;
    while (items[i] && (items[i].kind === 'gap' || isWs((items[i] as { ch: string }).ch))) i++;
    const next = items[i];
    return next?.kind === 'char' && next.ch === cells[k].ch ? k : -1;
  }

  /**
   * Typing before whitespace that ends the text (a line break typed and then
   * moved above, for example) leaves that whitespace out of the evaluation
   * until the user types past it again, so it does not count as a mistake in
   * the middle of what is being typed.
   */
  private deferTrailingSpace(): void {
    const ed = this.editor;
    const end = this.pendingStart();
    const to = ed.selection[1];
    if (to >= end) return;
    for (let i = to; i < end; i++) if (!isWs(ed.cells[i].ch)) return;
    ed.defer(to, end);
  }

  private atFrontier(): boolean {
    return !this.editor.hasSelection && this.editor.cursor === this.pendingStart();
  }

  /** Brings the evaluator in line with the edited text, re-evaluating only from the first change. */
  private sync(): void {
    const from = this.editor.takeDirty();
    const end = this.pendingStart();
    const keep = Math.min(from, end, this.results.length);
    while (this.results.length > keep) {
      this.evaluator.pop();
      this.results.pop();
    }
    const cells = this.editor.cells;
    for (let i = keep; i < end; i++) this.results.push(this.evaluator.push(cells[i].ch));
  }

  private typeChar(ch: string): boolean {
    const ed = this.editor;
    const saved = this.config.errorPolicy === 'block' ? ed.save() : null;
    this.deferTrailingSpace();
    // Past the evaluated text (inserted brackets the cursor moved over are evaluated with this key).
    const frontier = !ed.hasSelection && ed.cursor >= this.pendingStart();
    const [from, to] = ed.selection;
    const closer = !ed.hasSelection && isCloser(ch) ? this.aheadCloser(ch) : -1;
    const blockEnd = ch === '\n' && frontier ? this.blockEnd() : -1;
    if (closer >= 0) {
      // Type over the closing bracket the editor inserted (dropping the line break it had to itself).
      ed.delete(ed.cursor, closer);
      ed.markTyped(ed.cursor);
      ed.setCursor(ed.cursor + 1);
    } else if (blockEnd >= 0) {
      // The reference closes the block here: this line break replaces the one inserted before the closing bracket.
      ed.delete(ed.cursor, blockEnd);
      ed.insert(ch);
    } else if (this.config.autoClose && isOpener(ch) && closesBefore(ed.cells[to]?.ch) && !inLiteral(ed.text, from)) {
      ed.insert(ch);
      ed.insertAt(ed.cursor, CLOSER_OF[ch], 'ahead');
    } else {
      ed.insert(ch);
    }
    this.sync();
    const result = this.results[ed.cursor - 1];
    if (saved && result.status === 'error') {
      ed.restore(saved);
      this.sync();
      this.record('char', ch, result, false, true);
      return false;
    }
    this.record('char', ch, result);
    if (ch === '\n' && result.status !== 'error' && this.config.autoIndent) {
      const opener = ed.cursor - 2;
      const split = ed.cells[ed.cursor]?.ahead && ed.cells[ed.cursor].ch === CLOSER_OF[ed.cells[opener]?.ch];
      if (frontier) this.indentFromReference(result);
      else this.indentLikeEditor();
      if (split) {
        // As in an editor, `{|}` + Enter leaves the closing bracket on its own line.
        const start = ed.lineStart(opener);
        let end = start;
        while (isIndent(ed.cells[end].ch)) end++;
        ed.insertAt(ed.cursor, '\n' + ed.text.slice(start, end), 'ahead');
      }
    }
    return true;
  }

  /** At the end of the text: indents the new line as the reference does. */
  private indentFromReference(newline: KeystrokeResult): void {
    const { items, text } = this.target;
    const ev = this.evaluator;
    let indent = '';
    if (items[ev.pos]?.kind === 'char') {
      for (let i = ev.pos; items[i]?.kind === 'char' && isIndent((items[i] as { ch: string }).ch); i++) indent += (items[i] as { ch: string }).ch;
    } else if (newline.status === 'free') {
      let i = ev.pos;
      while (i < items.length && !(items[i].kind === 'char' && !isWs((items[i] as { ch: string }).ch))) i++;
      const src = items[i] ? items[i].src : text.length;
      indent = /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', src - 1) + 1, src))![0];
    }
    for (const ch of indent) {
      if (ev.peek(ch).status === 'error') break;
      this.editor.insert(ch, true);
      this.sync();
      this.record('char', ch, this.results[this.editor.cursor - 1], true);
    }
  }

  /** Inside the text: keeps the indentation of the previous line, one level deeper after `{`. */
  private indentLikeEditor(): void {
    const ed = this.editor;
    const nl = ed.cursor - 1;
    const start = ed.lineStart(nl);
    let end = start;
    while (end < nl && isIndent(ed.cells[end].ch)) end++;
    let indent = ed.text.slice(start, end);
    let last = nl - 1;
    while (last >= start && isIndent(ed.cells[last].ch)) last--;
    if (last >= start && isOpener(ed.cells[last].ch)) indent += indent.includes('\t') ? '\t' : INDENT_UNIT;
    if (!indent) return;
    ed.insert(indent, true);
    this.sync();
  }

  /** Runs a deletion; returns false (and records nothing) when there was nothing to delete. */
  private edit(kind: 'backspace' | 'wordBackspace' | 'delete' | 'wordDelete', apply: () => boolean): boolean {
    if (this._status === 'finished') return false;
    if (!apply()) return false;
    if (this._status === 'paused') this.resume();
    this.sync();
    this.counters.corrections++;
    this.log.push({ t: this.elapsed(), kind, status: 'undo', segment: this.segment });
    this.lastActivity = this.now();
    this.afterAction();
    this.emit();
    return true;
  }

  /** Closing brackets inserted ahead of the user, with the target item each one stands for. */
  private pendingChars(): PendingChar[] {
    const cells = this.editor.cells;
    const start = this.pendingStart();
    if (start === cells.length) return [];
    const items = this.target.items;
    const open: number[] = [];
    for (let i = 0; i < start; i++) {
      const r = this.results[i];
      const it = items[r.item];
      if (it?.kind === 'char' && LITERAL_TOKENS.has(it.tokenType)) continue;
      const ch = cells[i].ch;
      if (isOpener(ch)) open.push(i);
      else if (isCloser(ch) && cells[open[open.length - 1]]?.ch === openerOf(ch)) open.pop();
    }
    let j = 0;
    return cells.slice(start).map((cell) => {
      if (!isCloser(cell.ch)) return { ch: cell.ch, item: -1 };
      const o = open[open.length - 1 - j++];
      const r = o === undefined ? undefined : this.results[o];
      const closer = r && r.status === 'correct' ? closerOfOpener(this.target, r.item) : undefined;
      const it = closer === undefined ? undefined : items[closer];
      return { ch: cell.ch, item: it?.kind === 'char' && it.ch === cell.ch ? closer! : -1 };
    });
  }

  /** Correct characters of the current text that the user typed (not inserted by the editor). */
  private typedCorrect(): number {
    let n = 0;
    const items = this.target.items;
    this.results.forEach((r, i) => {
      if (r.status === 'correct' && !this.editor.cells[i].auto && items[r.item]?.kind === 'char') n++;
    });
    return n;
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
      correct: this.typedCorrect(),
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
    this.editor.reset();
    this.editor.takeDirty();
    this.results = [];
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
