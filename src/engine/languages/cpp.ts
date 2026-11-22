import type { LanguageProfile, LexOptions, Token, TokenType } from '../types';

export const CPP_KEYWORDS = new Set([
  'alignas', 'alignof', 'and', 'and_eq', 'asm', 'auto', 'bitand', 'bitor', 'bool', 'break', 'case',
  'catch', 'char', 'char8_t', 'char16_t', 'char32_t', 'class', 'compl', 'concept', 'const',
  'consteval', 'constexpr', 'constinit', 'const_cast', 'continue', 'co_await', 'co_return',
  'co_yield', 'decltype', 'default', 'delete', 'do', 'double', 'dynamic_cast', 'else', 'enum',
  'explicit', 'export', 'extern', 'false', 'float', 'for', 'friend', 'goto', 'if', 'inline', 'int',
  'long', 'mutable', 'namespace', 'new', 'noexcept', 'not', 'not_eq', 'nullptr', 'operator', 'or',
  'or_eq', 'private', 'protected', 'public', 'register', 'reinterpret_cast', 'requires', 'return',
  'short', 'signed', 'sizeof', 'static', 'static_assert', 'static_cast', 'struct', 'switch',
  'template', 'this', 'thread_local', 'throw', 'true', 'try', 'typedef', 'typeid', 'typename',
  'union', 'unsigned', 'using', 'virtual', 'void', 'volatile', 'wchar_t', 'while', 'xor', 'xor_eq',
]);

/** Punctuators sorted longest first (maximal munch). Includes digraphs. */
const PUNCTUATORS = [
  '%:%:', '<=>', '<<=', '>>=', '->*', '...',
  '::', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=', '/=',
  '%=', '&=', '|=', '^=', '.*', '##', '<:', ':>', '<%', '%>', '%:',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '&', '|', '^', '~', '?', ':', '.', ',', ';', '(', ')',
  '{', '}', '[', ']', '#',
];

const PUNCTUATION_CHARS = new Set(['(', ')', '{', '}', '[', ']', ';', ',', '<:', ':>', '<%', '%>']);

const STRING_PREFIXES = new Set(['L', 'u', 'U', 'u8']);
const RAW_PREFIXES = new Set(['R', 'LR', 'uR', 'UR', 'u8R']);
const INCLUDE_DIRECTIVES = new Set(['include', 'include_next', 'import']);

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => /[A-Za-z_$]/.test(c) || (c > '\x7f' && /\p{L}/u.test(c));
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c) || (c > '\x7f' && /\p{N}|\p{M}/u.test(c));
const isHSpace = (c: string) => c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === '\r';

/**
 * C++ lexer following the translation-phase-3 rules relevant to token boundaries:
 * maximal munch, pp-numbers, encoding prefixes, raw strings, user-defined literal
 * suffixes, comments, preprocessor directives and header names.
 */
export function lexCpp(src: string, options: LexOptions = {}): Token[] {
  const tokens: Token[] = [];
  const n = src.length;
  let i = 0;
  let atLineStart = options.atLineStart ?? true;
  let directive = options.inDirective ? 0 : -1;
  let directiveCount = options.inDirective ? 1 : 0;
  // State within the current directive: 0 = expecting `#`, 1 = expecting name, 2 = after name.
  let directiveName = '';
  let directiveTokens = 0;

  const push = (type: TokenType, start: number, end: number, extra?: Partial<Token>) => {
    const tok: Token = { type, text: src.slice(start, end), start, end, directive, ...extra };
    tokens.push(tok);
    return tok;
  };

  // Skips a backslash-newline continuation at position p, returning the new position.
  const lineContinuationAt = (p: number): number => {
    if (src[p] !== '\\') return -1;
    let q = p + 1;
    while (q < n && isHSpace(src[q]) && src[q] !== '\r') q++;
    if (src[q] === '\r' && src[q + 1] === '\n') return q + 2;
    if (src[q] === '\n') return q + 1;
    return -1;
  };

  while (i < n) {
    const c = src[i];
    const start = i;

    // Inside a directive, a newline terminates it: emit horizontal space separately.
    if (directive >= 0 && (isHSpace(c) || c === '\n')) {
      while (i < n && isHSpace(src[i])) i++;
      if (i > start) push('whitespace', start, i, { newlines: 0 });
      if (src[i] === '\n') {
        directive = -1;
        directiveName = '';
      }
      continue;
    }

    if (isHSpace(c) || c === '\n') {
      let newlines = 0;
      while (i < n && (isHSpace(src[i]) || src[i] === '\n')) {
        if (src[i] === '\n') newlines++;
        i++;
      }
      if (newlines > 0) atLineStart = true;
      push('whitespace', start, i, { newlines });
      continue;
    }

    // Backslash-newline continuation.
    const cont = lineContinuationAt(i);
    if (cont >= 0) {
      i = cont;
      push('whitespace', start, i, { newlines: 0, continuation: true });
      continue;
    }

    // Comments.
    if (c === '/' && src[i + 1] === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') {
        const lc = lineContinuationAt(i);
        i = lc >= 0 ? lc : i + 1;
      }
      while (i > start + 2 && isHSpace(src[i - 1])) i--;
      push('comment', start, i, { commentKind: 'line' });
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const close = src.indexOf('*/', i + 2);
      i = close < 0 ? n : close + 2;
      push('comment', start, i, { commentKind: 'block' });
      continue;
    }

    // Start of a preprocessor directive.
    const isHash = c === '#' || (c === '%' && src[i + 1] === ':' && !(src[i + 2] === '%' && src[i + 3] === ':'));
    if (isHash && atLineStart && directive < 0) {
      directive = directiveCount++;
      directiveName = '';
      directiveTokens = 0;
      i += c === '#' ? 1 : 2;
      push('preprocessor', start, i);
      atLineStart = false;
      continue;
    }
    atLineStart = false;

    if (directive >= 0) directiveTokens++;

    // Header name after #include.
    if (directive >= 0 && INCLUDE_DIRECTIVES.has(directiveName) && (c === '<' || c === '"')) {
      const close = src.indexOf(c === '<' ? '>' : '"', i + 1);
      const eol = src.indexOf('\n', i + 1);
      if (close >= 0 && (eol < 0 || close < eol)) {
        i = close + 1;
        push('header', start, i);
        directiveName = '#header';
        continue;
      }
    }

    // Identifiers, keywords and prefixed literals.
    if (isIdentStart(c)) {
      while (i < n && isIdentPart(src[i])) i++;
      const word = src.slice(start, i);
      if (RAW_PREFIXES.has(word) && src[i] === '"') {
        i = lexRawString(src, i);
        i = lexUdSuffix(src, i);
        push('string', start, i);
        continue;
      }
      if (STRING_PREFIXES.has(word) && (src[i] === '"' || src[i] === "'")) {
        const quote = src[i];
        i = lexQuoted(src, i, quote);
        i = lexUdSuffix(src, i);
        push(quote === '"' ? 'string' : 'char', start, i);
        continue;
      }
      const isDirectiveName = directive >= 0 && directiveTokens === 1;
      const type: TokenType = isDirectiveName ? 'preprocessor' : CPP_KEYWORDS.has(word) ? 'keyword' : 'identifier';
      const tok = push(type, start, i);
      if (isDirectiveName) directiveName = word;
      else if (directive >= 0 && directiveName === 'define' && directiveTokens === 2) {
        tok.macroName = true;
        if (src[i] === '(') tok.functionLikeMacro = true;
      }
      continue;
    }

    // pp-number: optional '.', digit, then [digits letters _ . ' e+ e- p+ p-]*
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      i++;
      while (i < n) {
        const d = src[i];
        if ((d === 'e' || d === 'E' || d === 'p' || d === 'P') && (src[i + 1] === '+' || src[i + 1] === '-')) {
          i += 2;
        } else if (d === "'" && i + 1 < n && (isIdentPart(src[i + 1]))) {
          i += 2;
        } else if (isIdentPart(d) || d === '.') {
          i++;
        } else break;
      }
      push('number', start, i);
      continue;
    }

    // String and character literals.
    if (c === '"' || c === "'") {
      i = lexQuoted(src, i, c);
      i = lexUdSuffix(src, i);
      push(c === '"' ? 'string' : 'char', start, i);
      continue;
    }

    // Punctuators.
    const punct = matchPunctuator(src, i);
    if (punct) {
      i += punct.length;
      push(PUNCTUATION_CHARS.has(punct) ? 'punctuation' : 'operator', start, i);
      continue;
    }

    // Anything else (e.g. '@', '`', stray backslash).
    i += c.length;
    push('unknown', start, i);
  }
  return tokens;
}

function matchPunctuator(src: string, i: number): string | null {
  for (const p of PUNCTUATORS) {
    if (src.startsWith(p, i)) {
      // [lex.pptoken]/3.2: `<::` not followed by `:` or `>` is lexed as `<` `::`.
      if (p === '<:' && src[i + 2] === ':' && src[i + 3] !== ':' && src[i + 3] !== '>') return '<';
      return p;
    }
  }
  return null;
}

function lexQuoted(src: string, i: number, quote: string): number {
  const n = src.length;
  i++;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === quote) return i + 1;
    if (ch === '\n') return i;
    i++;
  }
  return n;
}

function lexRawString(src: string, i: number): number {
  // i points at the opening quote.
  const open = src.indexOf('(', i + 1);
  if (open < 0) return lexQuoted(src, i, '"');
  const delim = src.slice(i + 1, open);
  if (delim.length > 16 || /[\s()\\]/.test(delim)) return lexQuoted(src, i, '"');
  const close = src.indexOf(`)${delim}"`, open + 1);
  return close < 0 ? src.length : close + delim.length + 2;
}

function lexUdSuffix(src: string, i: number): number {
  if (i < src.length && isIdentStart(src[i])) {
    while (i < src.length && isIdentPart(src[i])) i++;
  }
  return i;
}

export const cpp: LanguageProfile = {
  id: 'cpp',
  extensions: ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh', 'hxx', 'h', 'c', 'ipp', 'tpp'],
  lex: lexCpp,
  significantIndentation: false,
};
