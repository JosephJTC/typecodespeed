/** One character of the edited text. */
export interface Cell {
  ch: string;
  /** Inserted by the editor (auto-indentation, closing bracket), not typed by the user. */
  auto: boolean;
  /** Inserted ahead of the cursor (a closing bracket and the line break before it); not compared until typed over or past. */
  ahead?: boolean;
}

export type Motion = 'left' | 'right' | 'up' | 'down' | 'home' | 'end' | 'wordLeft' | 'wordRight' | 'docStart' | 'docEnd';

type CharClass = 'space' | 'newline' | 'word' | 'punct';

const classOf = (ch: string): CharClass =>
  ch === ' ' || ch === '\t' ? 'space' : ch === '\n' ? 'newline' : /[\p{L}\p{N}_]/u.test(ch) ? 'word' : 'punct';

/**
 * Text being typed, with a cursor and a selection, independent from the DOM.
 * Every change records the lowest offset it touched so that the comparison
 * engine only re-evaluates from there.
 */
export class EditorBuffer {
  readonly cells: Cell[] = [];
  /** Cursor offset (0..length). */
  cursor = 0;
  /** Other end of the selection; equal to `cursor` when nothing is selected. */
  anchor = 0;
  private goalCol: number | null = null;
  private dirty = Infinity;
  private cachedText: string | null = '';

  get length(): number {
    return this.cells.length;
  }

  get text(): string {
    return (this.cachedText ??= this.cells.map((c) => c.ch).join(''));
  }

  get hasSelection(): boolean {
    return this.anchor !== this.cursor;
  }

  /** Selected range `[from, to)`. */
  get selection(): [number, number] {
    return this.anchor < this.cursor ? [this.anchor, this.cursor] : [this.cursor, this.anchor];
  }

  /** Lowest offset changed since the previous call (`Infinity` if none), and resets it. */
  takeDirty(): number {
    const d = this.dirty;
    this.dirty = Infinity;
    return d;
  }

  /** Replaces the selection with `text` and leaves the cursor after it. */
  insert(text: string, auto = false): void {
    this.deleteSelection();
    this.insertAt(this.cursor, text, auto ? 'auto' : 'user');
    this.setCursor(this.cursor + text.length);
  }

  /** Inserts `text` at `pos` without moving the cursor unless it is after `pos`. */
  insertAt(pos: number, text: string, kind: 'user' | 'auto' | 'ahead' = 'user'): void {
    if (!text) return;
    this.cells.splice(pos, 0, ...Array.from(text, (ch): Cell => (kind === 'ahead' ? { ch, auto: true, ahead: true } : { ch, auto: kind === 'auto' })));
    this.touch(pos);
    if (this.cursor > pos) this.cursor += text.length;
    if (this.anchor > pos) this.anchor += text.length;
  }

  /** Deletes `[from, to)`. */
  delete(from: number, to: number): void {
    from = Math.max(0, from);
    to = Math.min(this.cells.length, to);
    if (to <= from) return;
    this.cells.splice(from, to - from);
    this.touch(from);
    const fix = (p: number) => (p >= to ? p - (to - from) : Math.min(p, from));
    this.cursor = fix(this.cursor);
    this.anchor = fix(this.anchor);
    this.goalCol = null;
  }

  deleteSelection(): boolean {
    if (!this.hasSelection) return false;
    const [from, to] = this.selection;
    this.delete(from, to);
    this.setCursor(from);
    return true;
  }

  /** Marks a character inserted by the editor as typed by the user. */
  markTyped(pos: number): void {
    const cell = this.cells[pos];
    if (!cell?.auto) return;
    cell.auto = false;
    cell.ahead = false;
    this.touch(pos);
  }

  setCursor(pos: number, extend = false): void {
    this.cursor = Math.max(0, Math.min(this.cells.length, pos));
    if (!extend) this.anchor = this.cursor;
    this.goalCol = null;
  }

  selectAll(): void {
    this.anchor = 0;
    this.cursor = this.cells.length;
    this.goalCol = null;
  }

  move(motion: Motion, extend = false): void {
    if (!extend && this.hasSelection && (motion === 'left' || motion === 'right')) {
      const [from, to] = this.selection;
      return this.setCursor(motion === 'left' ? from : to);
    }
    if (motion === 'up' || motion === 'down') {
      const col = this.goalCol ?? this.cursor - this.lineStart(this.cursor);
      const pos = motion === 'up' ? this.lineAbove(col) : this.lineBelow(col);
      this.setCursor(pos, extend);
      this.goalCol = col;
      return;
    }
    this.setCursor(this.target(motion), extend);
  }

  lineStart(pos: number): number {
    while (pos > 0 && this.cells[pos - 1].ch !== '\n') pos--;
    return pos;
  }

  lineEnd(pos: number): number {
    while (pos < this.cells.length && this.cells[pos].ch !== '\n') pos++;
    return pos;
  }

  /** Start of the word (or run of symbols) before `pos`, skipping spaces first. */
  wordLeft(pos: number): number {
    let i = pos;
    while (i > 0 && classOf(this.cells[i - 1].ch) === 'space') i--;
    if (i === 0) return 0;
    const cls = classOf(this.cells[i - 1].ch);
    if (cls === 'newline') return i === pos ? i - 1 : i;
    while (i > 0 && classOf(this.cells[i - 1].ch) === cls) i--;
    return i;
  }

  /** End of the word (or run of symbols) after `pos`, skipping spaces first. */
  wordRight(pos: number): number {
    const n = this.cells.length;
    let i = pos;
    while (i < n && classOf(this.cells[i].ch) === 'space') i++;
    if (i === n) return n;
    const cls = classOf(this.cells[i].ch);
    if (cls === 'newline') return i === pos ? i + 1 : i;
    while (i < n && classOf(this.cells[i].ch) === cls) i++;
    return i;
  }

  /** Copy of the content, cursor and selection, for `restore`. */
  save(): { cells: Cell[]; cursor: number; anchor: number } {
    return { cells: this.cells.map((c) => ({ ...c })), cursor: this.cursor, anchor: this.anchor };
  }

  restore(state: { cells: Cell[]; cursor: number; anchor: number }): void {
    this.cells.splice(0, this.cells.length, ...state.cells.map((c) => ({ ...c })));
    this.cursor = state.cursor;
    this.anchor = state.anchor;
    this.goalCol = null;
    this.touch(0);
  }

  reset(): void {
    this.cells.length = 0;
    this.cursor = this.anchor = 0;
    this.goalCol = null;
    this.touch(0);
  }

  private target(motion: Exclude<Motion, 'up' | 'down'>): number {
    const pos = this.cursor;
    switch (motion) {
      case 'left':
        return pos - 1;
      case 'right':
        return pos + 1;
      case 'wordLeft':
        return this.wordLeft(pos);
      case 'wordRight':
        return this.wordRight(pos);
      case 'home': {
        // Smart Home: first non-blank character of the line, then column 0.
        const start = this.lineStart(pos);
        let first = start;
        while (first < this.cells.length && classOf(this.cells[first].ch) === 'space') first++;
        return pos === first ? start : first;
      }
      case 'end':
        return this.lineEnd(pos);
      case 'docStart':
        return 0;
      case 'docEnd':
        return this.cells.length;
    }
  }

  private lineAbove(col: number): number {
    const start = this.lineStart(this.cursor);
    if (start === 0) return 0;
    const prev = this.lineStart(start - 1);
    return Math.min(prev + col, start - 1);
  }

  private lineBelow(col: number): number {
    const end = this.lineEnd(this.cursor);
    if (end === this.cells.length) return end;
    return Math.min(end + 1 + col, this.lineEnd(end + 1));
  }

  private touch(pos: number) {
    this.dirty = Math.min(this.dirty, pos);
    this.cachedText = null;
  }
}
