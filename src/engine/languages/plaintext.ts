import type { LanguageProfile, Token } from '../types';

/** Fallback lexer: words, numbers and single-character symbols. */
export function lexPlainText(src: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\s+)|([\p{L}\p{N}_]+)|([\s\S])/gu;
  for (const m of src.matchAll(re)) {
    const start = m.index;
    const text = m[0];
    const type = m[1] ? 'whitespace' : m[2] ? (/^\d/.test(text) ? 'number' : 'identifier') : 'punctuation';
    const tok: Token = { type, text, start, end: start + text.length, directive: -1 };
    if (type === 'whitespace') tok.newlines = text.split('\n').length - 1;
    tokens.push(tok);
  }
  return tokens;
}

export const plaintext: LanguageProfile = {
  id: 'plaintext',
  extensions: ['txt'],
  lex: lexPlainText,
  significantIndentation: false,
};
