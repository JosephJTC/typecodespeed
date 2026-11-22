import type { LanguageProfile, Token } from './types';

/**
 * Returns true when `a` and `b` cannot be written next to each other without
 * whitespace, i.e. concatenating their text would lex to something different
 * (`int`+`x` → `intx`, `-`+`-` → `--`, `/`+`*` → comment start, `"s"`+`s` → UDL...).
 */
export function needsSeparator(a: Token, b: Token, lang: LanguageProfile): boolean {
  if (a.type === 'comment' && a.commentKind === 'line') return true;
  if (b.type === 'header') return false;
  if (a.type === 'header') return false;
  const inDirective = a.directive >= 0 && b.directive === a.directive;
  const joined = a.text + b.text;
  const lexed = lang.lex(joined, { atLineStart: a.type === 'preprocessor' && a.text !== '' && isHash(a), inDirective: inDirective && !isHash(a) })
    .filter((t) => t.type !== 'whitespace');
  if (lexed.length !== 2) return true;
  return lexed[0].text !== a.text || lexed[1].text !== b.text;
}

function isHash(t: Token): boolean {
  return t.type === 'preprocessor' && (t.text === '#' || t.text === '%:');
}
