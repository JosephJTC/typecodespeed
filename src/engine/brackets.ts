import type { Target, TokenType } from './types';

const CLOSER_OF: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
const OPENERS = new Set(Object.keys(CLOSER_OF));
const CLOSERS = new Set(Object.values(CLOSER_OF));
/** Brackets inside these tokens are text, not structure. */
const LITERAL: ReadonlySet<TokenType> = new Set<TokenType>(['string', 'char', 'comment', 'header']);

const cache = new WeakMap<Target, Map<number, number>>();

/** Maps the item index of every closing bracket to the item index of its opening bracket. */
export function matchBrackets(target: Target): ReadonlyMap<number, number> {
  let pairs = cache.get(target);
  if (pairs) return pairs;
  pairs = new Map();
  const stack: number[] = [];
  target.items.forEach((it, i) => {
    if (it.kind !== 'char' || LITERAL.has(it.tokenType)) return;
    if (OPENERS.has(it.ch)) stack.push(i);
    else if (CLOSERS.has(it.ch)) {
      const open = stack[stack.length - 1];
      const opener = open === undefined ? undefined : target.items[open];
      if (opener?.kind === 'char' && CLOSER_OF[opener.ch] === it.ch) {
        stack.pop();
        pairs.set(i, open!);
      }
    }
  });
  cache.set(target, pairs);
  return pairs;
}
