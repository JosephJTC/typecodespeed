import { getLanguage } from './languages';
import { normalizeSource, stripComments } from './normalize';
import { DEFAULT_OPTIONS, resolveRules } from './rules';
import { needsSeparator } from './separation';
import type { CompareOptions, GapItem, LanguageProfile, Target, TargetItem, Token, WhitespaceRules } from './types';

/**
 * Builds the sequence of items the user has to type.
 *
 * Every non-whitespace character becomes a `char` item. Whitespace between two
 * tokens becomes either `char` items (when it must be reproduced exactly) or a
 * single `gap` item describing how much whitespace is accepted there.
 */
export function buildTarget(source: string, languageId = 'cpp', options: CompareOptions = DEFAULT_OPTIONS): Target {
  const lang = getLanguage(languageId);
  const rules = resolveRules(options, lang);
  let text = normalizeSource(source);
  if (options.comments === 'omit') text = stripComments(text, lang);
  const tokens = lang.lex(text);
  const items = new ItemBuilder(tokens);
  const significant: number[] = [];
  tokens.forEach((t, idx) => t.type !== 'whitespace' && significant.push(idx));

  if (significant.length > 0) {
    const first = tokens[significant[0]];
    if (first.start > 0) {
      const lead = text.slice(0, first.start);
      if (rules.indentation === 'exact') items.chars(lead, 0, -1);
      else items.gap({ min: 0, max: Infinity, spaces: true, newlines: true, requireNewline: false, src: 0, srcEnd: first.start, reason: 'formatting' });
    } else if (rules.indentation === 'ignore') {
      items.gap({ min: 0, max: Infinity, spaces: true, newlines: true, requireNewline: false, src: 0, srcEnd: 0, reason: 'formatting' });
    }
  }

  for (let k = 0; k < significant.length; k++) {
    const idx = significant[k];
    const tok = tokens[idx];
    emitToken(items, tok, idx, rules);
    if (k + 1 < significant.length) {
      const next = tokens[significant[k + 1]];
      const prevTok = k > 0 ? tokens[significant[k - 1]] : null;
      const before = prevTok && !needsSeparator(prevTok, tok, lang) ? prevTok : null;
      emitGap(items, tok, next, text, rules, lang, before);
    }
  }

  if (significant.length > 0) {
    // Trailing whitespace after the last token is always harmless.
    const end = text.length;
    items.gap({ min: 0, max: Infinity, spaces: true, newlines: true, requireNewline: false, src: end, srcEnd: end, reason: 'formatting' });
  }

  const list = items.done();
  return {
    text,
    tokens,
    items: list,
    charCount: list.reduce((acc, it) => acc + (it.kind === 'char' ? 1 : 0), 0),
    rules,
    language: lang.id,
  };
}

class ItemBuilder {
  private items: TargetItem[] = [];
  private readonly tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  chars(s: string, src: number, token: number) {
    const tokenType = token >= 0 ? this.tokens[token].type : 'whitespace';
    let off = 0;
    for (const ch of s) {
      this.items.push({ kind: 'char', ch, src: src + off, token, tokenType });
      off += ch.length;
    }
  }

  gap(g: Omit<GapItem, 'kind'>) {
    const last = this.items[this.items.length - 1];
    if (last && last.kind === 'gap') {
      // Adjacent gaps are merged into one that accepts the union of both.
      last.min = Math.max(last.min, g.min);
      last.max = Math.max(last.max, g.max);
      last.spaces ||= g.spaces;
      last.newlines ||= g.newlines;
      last.requireNewline ||= g.requireNewline;
      last.srcEnd = Math.max(last.srcEnd, g.srcEnd);
      if (last.reason === 'formatting' || last.reason === 'optional') last.reason = g.reason;
      return;
    }
    this.items.push({ kind: 'gap', ...g });
  }

  done(): TargetItem[] {
    return this.items;
  }
}

function emitToken(items: ItemBuilder, tok: Token, idx: number, rules: WhitespaceRules) {
  if (tok.type !== 'comment' || rules.inlineSpaces === 'exact') {
    items.chars(tok.text, tok.start, idx);
    return;
  }
  // Inside comments, any run of whitespace matches any run of whitespace.
  const re = /\s+|\S+/g;
  for (const m of tok.text.matchAll(re)) {
    const s = m[0];
    const at = tok.start + m.index;
    if (/^\s/.test(s)) {
      const hasNl = s.includes('\n');
      items.gap({
        min: 1,
        max: Infinity,
        spaces: true,
        newlines: hasNl || (tok.commentKind === 'block' && rules.lineBreaks === 'flexible'),
        requireNewline: hasNl && rules.lineBreaks === 'exact',
        src: at,
        srcEnd: at + s.length,
        reason: 'separator',
      });
    } else {
      items.chars(s, at, idx);
    }
  }
}

function emitGap(
  items: ItemBuilder,
  prev: Token,
  next: Token,
  text: string,
  rules: WhitespaceRules,
  lang: LanguageProfile,
  /** Token before `prev` when the gap between them may be empty, used to detect three-token merges (`. . .` → `...`). */
  before: Token | null,
) {
  const ws = text.slice(prev.end, next.start);
  const src = prev.end;
  const srcEnd = next.start;
  const sameDirective = prev.directive >= 0 && next.directive === prev.directive;
  const lineEnd = (prev.type === 'comment' && prev.commentKind === 'line') || (prev.directive >= 0 && next.directive !== prev.directive);
  const canBreak = rules.lineBreaks === 'flexible' && !sameDirective;

  if (ws.includes('\\') && /\\[ \t]*\n/.test(ws)) {
    // Backslash-newline continuations are reproduced literally.
    items.chars(ws, src, -1);
    return;
  }

  const newlineCount = ws.split('\n').length - 1;
  const required =
    needsSeparator(prev, next, lang) ||
    // `#define N (x)` defines an object-like macro: without the space it would take parameters.
    (prev.macroName === true && next.text === '(') ||
    (before !== null && mergesAcross(before, prev, next, lang));
  const reason: GapItem['reason'] = lineEnd ? 'lineEnd' : required ? 'separator' : 'optional';

  if (newlineCount > 0) {
    if (rules.lineBreaks === 'flexible') {
      // Outside the lexical mode a line break still stands for "at least one whitespace".
      const min = required || lineEnd || rules.inlineSpaces !== 'lexical' ? 1 : 0;
      items.gap({ min, max: Infinity, spaces: true, newlines: true, requireNewline: lineEnd, src, srcEnd, reason });
      return;
    }
    const firstNl = ws.indexOf('\n');
    const lastNl = ws.lastIndexOf('\n');
    if (rules.inlineSpaces !== 'exact') {
      // Trailing spaces before a line break are harmless.
      items.gap({ min: 0, max: Infinity, spaces: true, newlines: false, requireNewline: false, src, srcEnd: src + firstNl, reason: 'formatting' });
    } else if (firstNl > 0) {
      items.chars(ws.slice(0, firstNl), src, -1);
    }
    if (rules.blankLines === 'exact') {
      items.chars(ws.slice(firstNl, lastNl + 1), src + firstNl, -1);
    } else {
      items.gap({
        min: 1,
        max: Infinity,
        spaces: rules.inlineSpaces !== 'exact',
        newlines: true,
        requireNewline: true,
        src: src + firstNl,
        srcEnd: src + lastNl + 1,
        reason: lineEnd ? 'lineEnd' : 'formatting',
      });
    }
    const indent = ws.slice(lastNl + 1);
    if (rules.indentation === 'exact') items.chars(indent, src + lastNl + 1, -1);
    else items.gap({ min: 0, max: Infinity, spaces: true, newlines: false, requireNewline: false, src: src + lastNl + 1, srcEnd, reason: 'formatting' });
    return;
  }

  if (ws.length > 0) {
    if (rules.inlineSpaces === 'exact') items.chars(ws, src, -1);
    else if (rules.inlineSpaces === 'collapse')
      items.gap({ min: 1, max: Infinity, spaces: true, newlines: canBreak, requireNewline: false, src, srcEnd, reason: required ? 'separator' : 'formatting' });
    else items.gap({ min: required ? 1 : 0, max: Infinity, spaces: true, newlines: canBreak, requireNewline: false, src, srcEnd, reason });
    return;
  }

  if (prev.functionLikeMacro) {
    items.gap({ min: 0, max: 0, spaces: false, newlines: false, requireNewline: false, src, srcEnd, reason: 'forbidden' });
    return;
  }
  if (rules.inlineSpaces === 'lexical') {
    items.gap({ min: 0, max: Infinity, spaces: true, newlines: canBreak, requireNewline: false, src, srcEnd, reason: 'optional' });
  }
}

const SYMBOLIC = new Set(['operator', 'punctuation', 'number']);

function mergesAcross(a: Token, b: Token, c: Token, lang: LanguageProfile): boolean {
  if (!SYMBOLIC.has(a.type) || !SYMBOLIC.has(b.type) || !SYMBOLIC.has(c.type)) return false;
  const lexed = lang.lex(a.text + b.text + c.text, { inDirective: a.directive >= 0 && a.type !== 'preprocessor' }).filter((t) => t.type !== 'whitespace');
  return lexed.length !== 3 || lexed[0].text !== a.text || lexed[1].text !== b.text || lexed[2].text !== c.text;
}
