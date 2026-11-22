export * from './types';
export { lexCpp, CPP_KEYWORDS, cpp } from './languages/cpp';
export { plaintext } from './languages/plaintext';
export { getLanguage, languageForFile, listLanguages, registerLanguage } from './languages';
export { needsSeparator } from './separation';
export { normalizeSource, stripComments } from './normalize';
export { TOLERANT_RULES, EXACT_RULES, DEFAULT_OPTIONS, resolveRules } from './rules';
export { buildTarget } from './target';
export { Evaluator, evaluate } from './evaluator';
export type { Evaluation, EvaluationCounts, TypedChar } from './evaluator';
export { matchBrackets } from './brackets';
export { buildDisplay, ghostWhitespace } from './display';
export type { Display, DisplayCode } from './display';

import { evaluate } from './evaluator';
import { DEFAULT_OPTIONS } from './rules';
import { buildTarget } from './target';
import type { CompareOptions } from './types';

/** True when `typed` is a complete, error-free rendition of `source` under `options`. */
export function isEquivalent(source: string, typed: string, languageId = 'cpp', options: CompareOptions = DEFAULT_OPTIONS): boolean {
  const target = buildTarget(source, languageId, options);
  const ev = evaluate(target, typed);
  return ev.complete && ev.errors === 0;
}
