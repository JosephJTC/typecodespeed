/** Bracket pairs closed automatically, as in a code editor. */
export const CLOSER_OF: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };
const OPENER_OF: Readonly<Record<string, string>> = { ')': '(', ']': '[', '}': '{' };

export const isOpener = (ch: string | undefined): boolean => ch !== undefined && ch in CLOSER_OF;
export const isCloser = (ch: string | undefined): boolean => ch !== undefined && ch in OPENER_OF;
export const openerOf = (ch: string): string | undefined => OPENER_OF[ch];

/** Characters before which an opening bracket is closed (VS Code's `autoCloseBefore`, plus the end of the text). */
const CLOSE_BEFORE = new Set([';', ':', '.', ',', '=', '}', ']', ')', '>', ' ', '\t', '\n']);

export const closesBefore = (next: string | undefined): boolean => next === undefined || CLOSE_BEFORE.has(next);

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
