import type { Evaluator } from './evaluator';

/**
 * State of each displayed character: c correct, i incorrect, m required whitespace
 * that was skipped, f whitespace typed by the user, x extra typed character, p pending,
 * a closing bracket already inserted by the editor that is not evaluated yet.
 */
export type DisplayCode = 'c' | 'i' | 'm' | 'f' | 'x' | 'p' | 'a';

export interface Display {
  text: string;
  /** One `DisplayCode` per character of `text`. */
  codes: string;
  /** Offset in `text` where the cursor is. */
  caret: number;
  /** Selected range in `text` (`selStart === selEnd` when nothing is selected). */
  selStart: number;
  selEnd: number;
}

/** A character inserted by the editor after the evaluated text (a closing bracket or the line break before it), not evaluated yet. Whitespace is not drawn. */
export interface PendingChar {
  ch: string;
  /** Target item it stands for (drawn there, inside the pending code), or -1. */
  item: number;
}

export interface DisplayOptions {
  /** Inserted characters after the evaluated text, in order. */
  pending?: readonly PendingChar[];
  /** Cursor offset in the edited text (evaluated characters followed by `pending`); defaults to the end. */
  cursor?: number;
  /** Other end of the selection; defaults to `cursor`. */
  anchor?: number;
  /**
   * Draws only what is in the editor (no pending reference code) and incorrect
   * characters as typed instead of as expected, so the reference is not revealed.
   */
  hidePending?: boolean;
}

const SPACE_MARK = '␣';
const NEWLINE_MARK = '↵';
const mark = (ch: string) => (ch === '\n' ? NEWLINE_MARK : ch === ' ' || ch === '\t' ? SPACE_MARK : ch);

/**
 * Part of the reference whitespace `ref` still worth suggesting after the user
 * typed `typed` in the same gap: line breaks already typed are not suggested
 * again and the suggested indentation shrinks by what was typed on the last line.
 */
export function ghostWhitespace(ref: string, typed: string): string {
  if (!typed) return ref;
  const refBreaks = ref.split('\n').length - 1;
  const typedBreaks = typed.split('\n').length - 1;
  if (refBreaks === 0) return typedBreaks > 0 ? '' : ref.slice(typed.length);
  const indent = ref.slice(ref.lastIndexOf('\n') + 1);
  if (typedBreaks >= refBreaks) return indent.slice(typed.length - typed.lastIndexOf('\n') - 1);
  return '\n'.repeat(refBreaks - typedBreaks) + indent;
}

/**
 * Text to draw for a session: what was actually typed (with the user's own
 * whitespace and line breaks) followed by the pending reference text, which is
 * therefore laid out after the typed text instead of at its original position.
 */
export function buildDisplay(ev: Evaluator, options: DisplayOptions = {}): Display {
  const { items, text: source } = ev.target;
  const pending = options.pending ?? [];
  const blind = options.hidePending ?? false;
  const typedAt = new Map<number, Array<[string, DisplayCode]>>();
  const freeAt = new Map<number, string>();
  for (const k of ev.typed) {
    const at = k.freeAt >= 0 ? k.freeAt : k.extraAt;
    if (at < 0) continue;
    const list = typedAt.get(at) ?? [];
    if (k.freeAt >= 0) {
      list.push([k.ch, 'f']);
      freeAt.set(at, (freeAt.get(at) ?? '') + k.ch);
    } else {
      list.push([k.ch === '\n' ? NEWLINE_MARK + '\n' : k.ch, 'x']);
    }
    typedAt.set(at, list);
  }

  let text = '';
  let codes = '';
  /** Display offset of every edited character (typed ones, then pending ones). */
  const offsets: number[] = [];
  const put = (s: string, code: DisplayCode, typed = false) => {
    if (typed) offsets.push(text.length);
    text += s;
    codes += code.repeat(s.length);
  };
  const putTyped = (at: number) => typedAt.get(at)?.forEach(([s, code]) => put(s, code, true));

  for (let i = 0; i < ev.pos; i++) {
    putTyped(i);
    const item = items[i];
    const state = ev.states[i];
    if (item.kind === 'gap') {
      if (state === 'missed') put(item.requireNewline ? NEWLINE_MARK : SPACE_MARK, 'm');
    } else if (state === 'correct') put(item.ch, 'c', true);
    else if (state === 'incorrect') put(mark(blind ? (ev.typed[offsets.length]?.ch ?? item.ch) : item.ch), 'i', true);
    else if (state === 'missed') put(mark(item.ch), 'm');
  }
  putTyped(ev.pos);
  // A keystroke that left no visible trace (should not happen): keep the mapping aligned.
  while (offsets.length < ev.typedLength) offsets.push(text.length);
  const frontier = text.length;

  const current = items[ev.pos];
  // Without the pending code, inserted characters are drawn where they are in the editor, whitespace included.
  const inGhost = (p: PendingChar) => !blind && current !== undefined && p.item >= ev.pos && items[p.item]?.kind === 'char';
  const hidden = (p: PendingChar) => !blind && (p.ch === ' ' || p.ch === '\t' || p.ch === '\n');
  for (const p of pending) if (!inGhost(p) && !hidden(p)) put(p.ch, 'a');

  const pendingAt: number[] = [];
  if (current && !blind) {
    let from = current.src;
    if (current.kind === 'gap') {
      put(ghostWhitespace(source.slice(current.src, current.srcEnd), freeAt.get(ev.pos) ?? ''), 'p');
      from = current.srcEnd;
    }
    const shift = text.length - from;
    put(source.slice(from), 'p');
    const list = codes.split('');
    for (const p of pending) {
      if (!inGhost(p)) continue;
      const at = items[p.item].src + shift;
      list[at] = 'a';
      pendingAt.push(at);
    }
    codes = list.join('');
  }
  let inline = frontier;
  let ghost = 0;
  for (const p of pending) offsets.push(inGhost(p) ? pendingAt[ghost++] : hidden(p) ? inline : inline++);

  const edited = offsets.length;
  const at = (pos: number) => {
    if (pos <= 0) return offsets[0] ?? frontier;
    if (pos < ev.typedLength) return offsets[pos];
    if (pos === ev.typedLength) return frontier;
    return offsets[Math.min(pos, edited) - 1] + 1;
  };
  const cursor = options.cursor ?? edited;
  const caret = at(cursor);
  const other = at(options.anchor ?? cursor);
  return { text, codes, caret, selStart: Math.min(caret, other), selEnd: Math.max(caret, other) };
}
