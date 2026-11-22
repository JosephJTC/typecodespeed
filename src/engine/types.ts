/** Lexical categories produced by a language lexer. */
export type TokenType =
  | 'identifier'
  | 'keyword'
  | 'number'
  | 'string'
  | 'char'
  | 'comment'
  | 'operator'
  | 'punctuation'
  | 'preprocessor'
  | 'header'
  | 'whitespace'
  | 'unknown';

export interface Token {
  type: TokenType;
  text: string;
  /** Offset of the first character in the source text. */
  start: number;
  /** Offset one past the last character. */
  end: number;
  /** Index of the preprocessor directive this token belongs to, or -1. */
  directive: number;
  /** For comments: line (`//`) or block. */
  commentKind?: 'line' | 'block';
  /** For whitespace: number of logical line breaks it contains. */
  newlines?: number;
  /** For whitespace: true when it is a backslash-newline continuation. */
  continuation?: boolean;
  /** Name being defined by `#define`. */
  macroName?: boolean;
  /** Name of a function-like macro (`#define f(x)`): no whitespace may follow it. */
  functionLikeMacro?: boolean;
}

export interface LexOptions {
  /** Treat the beginning of the input as the beginning of a line (enables `#` directives). */
  atLineStart?: boolean;
  /** Lex the input as the body of a preprocessor directive. */
  inDirective?: boolean;
}

export interface LanguageProfile {
  id: string;
  /** File extensions (without dot) handled by this profile. */
  extensions: string[];
  lex(source: string, options?: LexOptions): Token[];
  /** Whether indentation and line breaks carry meaning (e.g. Python). */
  significantIndentation: boolean;
}

/** How whitespace is compared. */
export interface WhitespaceRules {
  /** Leading whitespace of each line. */
  indentation: 'exact' | 'ignore';
  /** Whitespace inside a line: exact, any run of ≥1, or only where tokens need it. */
  inlineSpaces: 'exact' | 'collapse' | 'lexical';
  /** Line breaks: exact, or interchangeable with other whitespace (respecting lexical needs). */
  lineBreaks: 'exact' | 'flexible';
  /** Consecutive empty lines. */
  blankLines: 'exact' | 'ignore';
}

export type ComparisonMode = 'tolerant' | 'exact' | 'custom';

export interface CompareOptions {
  mode: ComparisonMode;
  /** Only used when `mode === 'custom'`. */
  custom?: WhitespaceRules;
  comments: 'include' | 'omit';
}

export interface CharItem {
  kind: 'char';
  ch: string;
  /** Offset in the practice text. */
  src: number;
  /** Index of the token in the practice text, or -1 for formatting whitespace. */
  token: number;
  tokenType: TokenType;
}

/** A flexible whitespace gap between tokens. */
export interface GapItem {
  kind: 'gap';
  /** Minimum number of whitespace characters. */
  min: number;
  /** Maximum number of whitespace characters (0 = whitespace forbidden). */
  max: number;
  spaces: boolean;
  newlines: boolean;
  requireNewline: boolean;
  /** Range of the original whitespace in the practice text. */
  src: number;
  srcEnd: number;
  /** Why the gap requires (or forbids) whitespace. */
  reason: 'optional' | 'separator' | 'lineEnd' | 'forbidden' | 'formatting';
}

export type TargetItem = CharItem | GapItem;

export interface Target {
  /** Normalized text that is shown to the user. */
  text: string;
  tokens: Token[];
  items: TargetItem[];
  /** Number of `char` items (characters that must be typed). */
  charCount: number;
  rules: WhitespaceRules;
  language: string;
}

export type ErrorKind =
  /** A different character was typed. */
  | 'substitution'
  /** A character was typed where nothing was expected (extra whitespace inside a token, past the end...). */
  | 'insertion'
  /** Whitespace needed to separate two tokens is missing. */
  | 'missingSeparator'
  /** A line break is required (after `//` comments or preprocessor directives). */
  | 'missingNewline'
  /** Whitespace is not allowed here (e.g. between a function-like macro name and `(`). */
  | 'forbiddenWhitespace'
  /** A line break is not allowed here (inside a preprocessor directive or a single line). */
  | 'unexpectedNewline'
  /** Formatting whitespace that must be reproduced (exact modes) is missing. */
  | 'missingWhitespace';

export type ItemState = 'pending' | 'correct' | 'incorrect' | 'missed' | 'satisfied';

export interface KeystrokeResult {
  status: 'correct' | 'error' | 'free';
  /** Item that the keystroke matched or was attributed to. */
  item: number;
  error?: ErrorKind;
}
