import { matchBrackets } from './brackets';
import type { Evaluator } from './evaluator';

/**
 * State of each displayed character: c correct, i incorrect, m required whitespace
 * that was skipped, f whitespace typed by the user, x extra typed character, p pending,
 * a pending closing bracket that is already inserted because its opening bracket was typed.
 */
export type DisplayCode = 'c' | 'i' | 'm' | 'f' | 'x' | 'p' | 'a';

export interface Display {
  text: string;
  /** One `DisplayCode` per character of `text`. */
  codes: string;
  /** Offset in `text` where the cursor is. */
  caret: number;
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
export function buildDisplay(ev: Evaluator, options: { autoClose?: boolean } = {}): Display {
  const { items, text: source } = ev.target;
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
  const put = (s: string, code: DisplayCode) => {
    text += s;
    codes += code.repeat(s.length);
  };
  const putTyped = (at: number) => typedAt.get(at)?.forEach(([s, code]) => put(s, code));

  for (let i = 0; i < ev.pos; i++) {
    putTyped(i);
    const item = items[i];
    const state = ev.states[i];
    if (item.kind === 'gap') {
      if (state === 'missed') put(item.requireNewline ? NEWLINE_MARK : SPACE_MARK, 'm');
    } else if (state === 'correct') put(item.ch, 'c');
    else if (state === 'incorrect') put(mark(item.ch), 'i');
    else if (state === 'missed') put(mark(item.ch), 'm');
  }
  putTyped(ev.pos);
  const caret = text.length;

  const current = items[ev.pos];
  if (!current) return { text, codes, caret };
  let from = current.src;
  if (current.kind === 'gap') {
    put(ghostWhitespace(source.slice(current.src, current.srcEnd), freeAt.get(ev.pos) ?? ''), 'p');
    from = current.srcEnd;
  }
  const rest = text.length - from;
  put(source.slice(from), 'p');
  if (options.autoClose) {
    const closed: number[] = [];
    for (const [closer, opener] of matchBrackets(ev.target)) {
      if (closer >= ev.pos && opener < ev.pos && ev.states[opener] === 'correct') closed.push(items[closer].src + rest);
    }
    if (closed.length) {
      const list = codes.split('');
      for (const at of closed) list[at] = 'a';
      codes = list.join('');
    }
  }
  return { text, codes, caret };
}
