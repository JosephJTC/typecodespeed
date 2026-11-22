import { needsSeparator } from './separation';
import type { LanguageProfile, Token } from './types';

/**
 * Normalizes source text for practice: removes the BOM, converts CRLF/CR to LF,
 * strips trailing whitespace on every line and leading/trailing blank lines.
 * Tabs and indentation are preserved.
 */
export function normalizeSource(src: string): string {
  let s = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+$/, ''))
    .join('\n');
  return s.replace(/^\n+/, '').replace(/\n+$/, '');
}

/**
 * Removes comments while keeping the code lexically identical:
 * - lines that only contained comments disappear;
 * - a comment between two tokens is replaced by a space only when the tokens need one.
 * The result is normalized again.
 */
export function stripComments(src: string, lang: LanguageProfile): string {
  const tokens = lang.lex(src);
  if (!tokens.some((t) => t.type === 'comment')) return src;
  let out = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== 'comment') {
      out += t.text;
      continue;
    }
    // Drop the horizontal whitespace already emitted before the comment.
    const trimmed = out.replace(/[ \t\f\v]+$/, '');
    const lineStartsHere = trimmed === '' || trimmed.endsWith('\n');
    out = trimmed;
    const prev = previousSignificant(tokens, i);
    const next = nextSignificant(tokens, i);
    const nextWs = tokens[i + 1]?.type === 'whitespace' ? tokens[i + 1] : null;
    if (lineStartsHere) {
      // Comment-only line(s): swallow the line break that follows.
      if (nextWs && (nextWs.newlines ?? 0) > 0) {
        const afterBreak = nextWs.text.slice(nextWs.text.indexOf('\n') + 1);
        out += afterBreak;
        i++;
      } else if (nextWs) {
        i++;
      }
      continue;
    }
    if (nextWs) continue;
    if (prev && next && needsSeparator(prev, next, lang)) out += ' ';
  }
  return normalizeSource(out);
}

function previousSignificant(tokens: Token[], i: number): Token | null {
  for (let j = i - 1; j >= 0; j--) if (tokens[j].type !== 'whitespace' && tokens[j].type !== 'comment') return tokens[j];
  return null;
}

function nextSignificant(tokens: Token[], i: number): Token | null {
  for (let j = i + 1; j < tokens.length; j++) if (tokens[j].type !== 'whitespace' && tokens[j].type !== 'comment') return tokens[j];
  return null;
}
