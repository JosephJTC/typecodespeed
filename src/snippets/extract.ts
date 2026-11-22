import { getLanguage, normalizeSource, type Token } from '../engine';

export interface Snippet {
  text: string;
  /** Nesting depth of the block in its source (0 = top level). */
  depth: number;
  lines: number;
}

export interface SnippetOptions {
  minLines: number;
  maxLines: number;
}

export const DEFAULT_SNIPPET_OPTIONS: SnippetOptions = { minLines: 3, maxLines: 30 };

const OPEN = new Set(['{', '<%']);
const CLOSE = new Set(['}', '%>']);

/**
 * Finds self-contained blocks (functions, structs, loops...) in a source file:
 * every `{ ... }` together with the declaration or statement that introduces it.
 * Blocks are cut on whole lines and dedented.
 */
export function extractBlocks(source: string, languageId = 'cpp'): Snippet[] {
  const text = normalizeSource(source);
  const tokens = getLanguage(languageId).lex(text).filter((t) => t.type !== 'whitespace');
  const blocks: Snippet[] = [];
  const stmtStart: Array<number | null> = [null];
  const open: Array<{ start: number; depth: number }> = [];

  const startAt = (depth: number, i: number) => {
    stmtStart[depth] = i + 1 < tokens.length ? i + 1 : null;
  };

  stmtStart[0] = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const depth = open.length;
    if (tok.directive >= 0) {
      // Directives never start a block: the statement begins after them.
      if (stmtStart[depth] === i || stmtStart[depth] === null) startAt(depth, i);
      continue;
    }
    if (tok.type !== 'punctuation' && tok.type !== 'operator') continue;
    if (OPEN.has(tok.text)) {
      open.push({ start: stmtStart[depth] ?? i, depth });
      stmtStart[depth + 1] = i + 1;
    } else if (CLOSE.has(tok.text) && open.length > 0) {
      const o = open.pop()!;
      let endTok: Token = tok;
      let next = i + 1;
      if (tokens[next]?.text === ';') endTok = tokens[next++];
      blocks.push(cut(text, tokens[o.start], endTok, o.depth));
      stmtStart[o.depth] = next < tokens.length ? next : null;
      if (next !== i + 1) i = next - 1;
    } else if (tok.text === ';') {
      startAt(depth, i);
    }
  }
  return blocks;
}

function cut(text: string, first: Token, last: Token, depth: number): Snippet {
  const start = text.lastIndexOf('\n', first.start - 1) + 1;
  let end = text.indexOf('\n', last.end);
  if (end < 0) end = text.length;
  const body = dedent(text.slice(start, end));
  return { text: body, depth, lines: body.split('\n').length };
}

export function dedent(text: string): string {
  const lines = text.split('\n');
  let common = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    common = Math.min(common, line.length - line.trimStart().length);
  }
  if (!Number.isFinite(common) || common === 0) return text;
  return lines.map((l) => l.slice(Math.min(common, l.length - l.trimStart().length))).join('\n');
}

/**
 * Picks a random snippet from the sources: a whole block with a suitable length
 * when possible, otherwise a window of consecutive lines.
 */
export function pickSnippet(
  sources: readonly string[],
  rand: () => number,
  options: SnippetOptions = DEFAULT_SNIPPET_OPTIONS,
  languageId = 'cpp',
  avoid?: string,
): string {
  const usable = sources.filter((s) => s.trim());
  if (usable.length === 0) return '';
  const candidates: string[] = [];
  for (const src of usable) {
    for (const b of extractBlocks(src, languageId)) {
      if (b.lines >= options.minLines && b.lines <= options.maxLines) candidates.push(b.text);
    }
  }
  const fresh = candidates.filter((c) => c !== avoid);
  const pool = fresh.length > 0 ? fresh : candidates;
  if (pool.length > 0) return pool[Math.floor(rand() * pool.length)];
  const src = normalizeSource(usable[Math.floor(rand() * usable.length)]);
  const lines = src.split('\n');
  const len = Math.min(options.maxLines, lines.length);
  const windows = new Set<string>();
  for (let from = 0; from + len <= lines.length; from++) {
    const w = dedent(normalizeSource(lines.slice(from, from + len).join('\n')));
    if (w.trim()) windows.add(w);
  }
  const all = [...windows];
  const freshWindows = all.filter((w) => w !== avoid);
  const windowPool = freshWindows.length > 0 ? freshWindows : all;
  return windowPool.length > 0 ? windowPool[Math.floor(rand() * windowPool.length)] : '';
}
