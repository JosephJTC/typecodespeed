import { describe, expect, it } from 'vitest';
import { buildTarget, isEquivalent, lexCpp } from '..';
import type { CompareOptions, Token } from '../types';
import { CORPUS } from './fixtures';
import { pick, rng } from './random';

/**
 * Independent oracle: two programs are lexically equivalent when the lexer
 * produces the same tokens, grouped in the same preprocessor directives.
 * It does not use the gap logic of the engine.
 */
function signature(src: string): string[] {
  return lexCpp(src)
    .filter((t: Token) => t.type !== 'whitespace')
    .map((t) => `${t.type}|${t.text}|${t.directive}|${t.functionLikeMacro ? 'fn' : ''}`);
}

const TOL: CompareOptions = { mode: 'tolerant', comments: 'omit' };
const GAPS = ['', '', ' ', '  ', '\t', '\n', '\n    ', ' \n\n\t'];

/** Rewrites the whitespace between tokens: each gap is replaced with probability `rate`. */
function reformat(src: string, rand: () => number, rate: number): string {
  const toks = lexCpp(src).filter((t) => t.type !== 'whitespace');
  let out = pick(rand, ['', '  ', '\n']);
  toks.forEach((t, i) => {
    out += t.text;
    if (i + 1 < toks.length) out += rand() < rate ? pick(rand, GAPS) : src.slice(t.end, toks[i + 1].start);
  });
  return out;
}

describe('propiedad: modo tolerante ⇔ equivalencia léxica', () => {
  it.each(Object.entries(CORPUS))('%s (600 reformateos aleatorios)', (_name, src) => {
    const target = buildTarget(src, 'cpp', TOL);
    const expected = signature(target.text);
    const rand = rng(src.length);
    let equivalent = 0;
    let different = 0;
    for (let i = 0; i < 600; i++) {
      const typed = reformat(target.text, rand, [1, 0.3, 0.05, 0.01][i % 4]);
      const oracle = signature(typed).join('\n') === expected.join('\n');
      expect(isEquivalent(target.text, typed, 'cpp', TOL), JSON.stringify(typed)).toBe(oracle);
      if (oracle) equivalent++;
      else different++;
    }
    // Both outcomes must be exercised for the property to be meaningful.
    expect(equivalent).toBeGreaterThan(0);
    expect(different).toBeGreaterThan(0);
  });

  it.each(Object.entries(CORPUS))('%s: reformateos que respetan separadores siempre se aceptan', (_name, src) => {
    const target = buildTarget(src, 'cpp', TOL);
    const toks = lexCpp(target.text).filter((t) => t.type !== 'whitespace');
    const rand = rng(99);
    for (let iter = 0; iter < 100; iter++) {
      let out = '';
      toks.forEach((t, i) => {
        out += t.text;
        const next = toks[i + 1];
        if (!next) return;
        const original = target.text.slice(t.end, next.start);
        const lineEnd = t.directive >= 0 && next.directive !== t.directive;
        const inDirective = t.directive >= 0 && next.directive === t.directive;
        if (lineEnd) out += pick(rand, ['\n', '\n\n  ', '  \n']);
        else if (t.functionLikeMacro) out += '';
        else if (original.length > 0) out += pick(rand, inDirective ? [' ', '   ', '\t'] : [' ', '  ', '\n', '\n\t\t']);
        else out += pick(rand, inDirective ? ['', ' '] : ['', '', ' ', '\n']);
      });
      expect(isEquivalent(target.text, out, 'cpp', TOL), JSON.stringify(out)).toBe(true);
    }
  });
});

describe('propiedad: modo exacto rechaza cualquier cambio', () => {
  const EXACT: CompareOptions = { mode: 'exact', comments: 'include' };
  it.each(Object.entries(CORPUS))('%s (300 mutaciones aleatorias)', (_name, src) => {
    const target = buildTarget(src, 'cpp', EXACT);
    const text = target.text;
    const rand = rng(7 + text.length);
    for (let i = 0; i < 300; i++) {
      const p = Math.floor(rand() * text.length);
      const kind = pick(rand, ['insertSpace', 'insertNewline', 'delete', 'replace'] as const);
      let typed: string;
      if (kind === 'insertSpace') typed = text.slice(0, p) + ' ' + text.slice(p);
      else if (kind === 'insertNewline') typed = text.slice(0, p) + '\n' + text.slice(p);
      else if (kind === 'delete') typed = text.slice(0, p) + text.slice(p + 1);
      else typed = text.slice(0, p) + (text[p] === 'x' ? 'y' : 'x') + text.slice(p + 1);
      expect(isEquivalent(text, typed, 'cpp', EXACT), `${kind}@${p}`).toBe(false);
    }
  });
});

describe('propiedad: modo tolerante rechaza cambios en tokens', () => {
  it.each(Object.entries(CORPUS))('%s (300 mutaciones dentro de tokens)', (_name, src) => {
    const target = buildTarget(src, 'cpp', TOL);
    const toks = lexCpp(target.text).filter((t) => t.text.length > 1 && t.type !== 'whitespace');
    const rand = rng(31 + target.text.length);
    for (let i = 0; i < 300; i++) {
      const t = pick(rand, toks);
      const p = t.start + 1 + Math.floor(rand() * (t.text.length - 1));
      const ws = pick(rand, [' ', '\n', '\t']);
      // A string literal may legally contain the inserted space only if it matches; it never does here.
      const typed = target.text.slice(0, p) + ws + target.text.slice(p);
      expect(isEquivalent(target.text, typed, 'cpp', TOL), JSON.stringify(t.text) + '@' + p).toBe(false);
    }
  });
});
