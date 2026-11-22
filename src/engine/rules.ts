import type { CompareOptions, LanguageProfile, WhitespaceRules } from './types';

/** Mode A: whitespace only matters where it separates tokens or ends a line comment/directive. */
export const TOLERANT_RULES: WhitespaceRules = {
  indentation: 'ignore',
  inlineSpaces: 'lexical',
  lineBreaks: 'flexible',
  blankLines: 'ignore',
};

/** Mode B: whitespace, indentation and line breaks must match. */
export const EXACT_RULES: WhitespaceRules = {
  indentation: 'exact',
  inlineSpaces: 'exact',
  lineBreaks: 'exact',
  blankLines: 'exact',
};

export const DEFAULT_OPTIONS: CompareOptions = { mode: 'tolerant', comments: 'omit' };

export function resolveRules(options: CompareOptions, lang: LanguageProfile): WhitespaceRules {
  const base =
    options.mode === 'exact' ? EXACT_RULES : options.mode === 'custom' ? (options.custom ?? TOLERANT_RULES) : TOLERANT_RULES;
  if (!lang.significantIndentation) return { ...base };
  // Languages where indentation is syntax keep line structure even in tolerant modes.
  return { ...base, lineBreaks: 'exact', indentation: 'exact' };
}
