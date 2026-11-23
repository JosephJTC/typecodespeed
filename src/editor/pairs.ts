/** Bracket pairs closed automatically, as in a code editor. */
export const CLOSER_OF: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };
const OPENER_OF: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' };

export const isOpener = (ch: string | undefined): boolean => ch !== undefined && ch in CLOSER_OF;
export const isCloser = (ch: string | undefined): boolean => ch !== undefined && ch in OPENER_OF;
export const openerOf = (ch: string): string | undefined => OPENER_OF[ch];

/** Characters before which an opening bracket is closed (VS Code's `autoCloseBefore`, plus the end of the text). */
const CLOSE_BEFORE = new Set([';', ':', '.', ',', '=', '}', ']', ')', '>', ' ', '\t', '\n']);

export const closesBefore = (next: string | undefined): boolean => next === undefined || CLOSE_BEFORE.has(next);

/** Quotes closed automatically: `"` strings and `'` character literals. */
export const isQuote = (ch: string | undefined): boolean => ch === '"' || ch === "'";

/**
 * Whether typing quote `ch` at `pos` of `text` opens a pair, as in VS Code: in
 * code (not inside a literal or comment), not right after a word character
 * (`don't`, `1'000'000`) and before a character that allows closing.
 */
export function opensQuote(text: string, pos: number, next: string | undefined): boolean {
  return closesBefore(next) && !/[A-Za-z0-9_]/.test(text[pos - 1] ?? '') && !inLiteral(text, pos);
}

/** Whether the character at `pos` is escaped by an odd number of backslashes before it. */
export function isEscaped(text: string, pos: number): boolean {
  let n = 0;
  while (text[pos - 1 - n] === '\\') n++;
  return n % 2 === 1;
}

/**
 * True when offset `pos` of C-like source `text` is inside a string, character
 * literal or comment (where brackets are plain text and must not be paired).
 */
export function inLiteral(text: string, pos: number): boolean {
  let state: 'code' | 'line' | 'block' | 'string' | 'char' = 'code';
  for (let i = 0; i < pos; i++) {
    const ch = text[i];
    const next = text[i + 1];
    switch (state) {
      case 'code':
        if (ch === '/' && next === '/' && i + 1 < pos) {
          state = 'line';
          i++;
        } else if (ch === '/' && next === '*' && i + 1 < pos) {
          state = 'block';
          i++;
        } else if (ch === '"') state = 'string';
        else if (ch === "'" && !/[0-9A-Fa-f]/.test(text[i - 1] ?? '')) state = 'char'; // 1'000'000 is a digit separator
        break;
      case 'line':
        if (ch === '\n' && text[i - 1] !== '\\') state = 'code';
        break;
      case 'block':
        if (ch === '*' && next === '/' && i + 1 < pos) {
          state = 'code';
          i++;
        }
        break;
      case 'string':
      case 'char':
        if (ch === '\\') i++;
        else if (ch === '\n' || ch === (state === 'string' ? '"' : "'")) state = 'code';
        break;
    }
  }
  return state !== 'code';
}
