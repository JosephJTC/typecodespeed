import type { CompareOptions, WhitespaceRules } from '../../engine';
import type { ErrorPolicy, SessionConfig } from '../../session';
import type { TestMeta, TestType } from '../../stats';
import { filterFiles, pickRandomFile, type FileQuery, type Library, type RefFile } from '../../library';
import { DEFAULT_SNIPPET_OPTIONS, pickSnippet, SAMPLES } from '../../snippets';

export type { TestType } from '../../stats';

export interface PracticeSettings {
  testType: TestType;
  durationSec: number;
  /** Sample id, `all`, `custom`, `ref` (the selected reference file) or `refRandom` (a random reference). */
  source: string;
  customCode: string;
  /** Path of the selected reference file within the local library. */
  refPath: string;
  /** Filters that limit which references `refRandom` may pick. */
  refQuery: FileQuery;
  /** Same as `refPath`/`refQuery` for the GitHub repository (`gh`/`ghRandom`); never saved. */
  ghPath: string;
  ghQuery: FileQuery;
  mode: CompareOptions['mode'];
  comments: CompareOptions['comments'];
  custom: WhitespaceRules;
  errorPolicy: ErrorPolicy;
  autoIndent: boolean;
  autoClose: boolean;
  /** Hides the pending code once typing starts (memory practice); scoring is unchanged. */
  hideGuide: boolean;
  idleSec: number;
  /** Code font size in pixels. */
  fontSize: number;
  /** Color theme; `system` follows the operating system. */
  theme: Theme;
}

export type Theme = 'dark' | 'light' | 'system';
export const THEMES: Theme[] = ['dark', 'light', 'system'];

export const DURATIONS = [15, 30, 60, 120, 300];
export const IDLE_OPTIONS = [0, 5, 10, 30];
export const FONT_SIZES = [13, 15, 17, 19, 22];

export const DEFAULT_SETTINGS: PracticeSettings = {
  testType: 'full',
  durationSec: 60,
  source: SAMPLES[0].id,
  customCode: '',
  refPath: '',
  refQuery: {},
  ghPath: '',
  ghQuery: {},
  mode: 'tolerant',
  comments: 'omit',
  custom: { indentation: 'ignore', inlineSpaces: 'collapse', lineBreaks: 'exact', blankLines: 'ignore' },
  errorPolicy: 'advance',
  autoIndent: true,
  autoClose: true,
  hideGuide: false,
  idleSec: 10,
  fontSize: 15,
  theme: 'dark',
};

const SETTINGS_KEY = 'typecodespeed.settings';

/** Restores saved settings, ignoring unknown keys and values of the wrong type. */
export function parseSettings(json: string | null): PracticeSettings {
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  try {
    const saved: unknown = JSON.parse(json ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
        const v = (saved as Record<string, unknown>)[k];
        if (v !== null && typeof v === typeof def) out[k] = typeof def === 'object' ? { ...def, ...(v as object) } : v;
      }
    }
  } catch {
    // Corrupt settings: fall back to the defaults.
  }
  // The repository lives only in memory, so after a reload it is gone.
  if (isGitHubSource(out.source as string)) out.source = DEFAULT_SETTINGS.source;
  out.ghPath = '';
  out.ghQuery = {};
  return out as unknown as PracticeSettings;
}

export function loadSettings(): PracticeSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: PracticeSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, ghPath: '', ghQuery: {} }));
  } catch {
    // Storage unavailable (private mode): settings last for this visit only.
  }
}

export const isRefSource = (source: string) => source === 'ref' || source === 'refRandom';
export const REF_PREFIX = 'ref:';
export const isGitHubSource = (source: string) => source === 'gh' || source === 'ghRandom';
/** History id prefix of the files of a GitHub repository. */
export const ghPrefix = (repoName: string) => `gh:${repoName}:`;

/** The code a test draws from, with what is needed to label the result. */
export interface ResolvedSource {
  id: string;
  name: string;
  language: string;
  codes: string[];
}

/** Finds the code to practice. `refRandom` draws a file, avoiding `previousId` when possible. */
export function resolveSource(
  s: PracticeSettings,
  files: readonly RefFile[],
  names: { all: string; custom: string },
  rand: () => number = Math.random,
  previousId?: string,
  /** Repository loaded from GitHub, for `gh` and `ghRandom`. */
  repo: Library | null = null,
): ResolvedSource | null {
  const ofFile = (f: RefFile | undefined, prefix = REF_PREFIX, label = ''): ResolvedSource | null =>
    f ? { id: prefix + f.path, name: label + f.path, language: f.language, codes: [f.text] } : null;
  if (isGitHubSource(s.source)) {
    if (!repo) return null;
    const prefix = ghPrefix(repo.name);
    const label = `${repo.name}: `;
    if (s.source === 'gh') return ofFile(repo.files.find((f) => f.path === s.ghPath), prefix, label);
    return ofFile(pickRandomFile(filterFiles(repo.files, s.ghQuery), rand, previousId?.startsWith(prefix) ? previousId.slice(prefix.length) : undefined), prefix, label);
  }
  if (s.source === 'ref') return ofFile(files.find((f) => f.path === s.refPath));
  if (s.source === 'refRandom') return ofFile(pickRandomFile(filterFiles(files, s.refQuery), rand, previousId?.slice(REF_PREFIX.length)));
  if (s.source === 'custom') return s.customCode.trim() ? { id: 'custom', name: names.custom, language: 'cpp', codes: [s.customCode] } : null;
  if (s.source === 'all') return { id: 'all', name: names.all, language: 'cpp', codes: SAMPLES.map((x) => x.code) };
  const sample = SAMPLES.find((x) => x.id === s.source);
  return sample ? { id: sample.id, name: sample.name, language: 'cpp', codes: [sample.code] } : null;
}

/** First text of a test and, for timed tests, a generator of further texts. */
export function textsFor(
  s: PracticeSettings,
  source: ResolvedSource,
  rand: () => number = Math.random,
  /** Text just practiced; a different one is chosen when possible. */
  previous?: string,
): { first: string; next?: () => string } {
  const { codes, language } = source;
  if (s.testType === 'snippet') return { first: pickSnippet(codes, rand, DEFAULT_SNIPPET_OPTIONS, language, previous) };
  if (s.testType === 'timed') {
    let last = previous;
    const next = () => (last = pickSnippet(codes, rand, DEFAULT_SNIPPET_OPTIONS, language, last));
    return { first: next(), next };
  }
  const fresh = codes.length > 1 ? codes.filter((x) => x !== previous) : codes;
  return { first: fresh[Math.floor(rand() * fresh.length)] };
}

export function sessionConfig(s: PracticeSettings, language: string, next?: () => string): SessionConfig {
  return {
    compare: { mode: s.mode, comments: s.comments, custom: s.custom },
    language,
    errorPolicy: s.errorPolicy,
    timeLimitMs: s.testType === 'timed' ? s.durationSec * 1000 : undefined,
    nextText: next,
    autoIndent: s.autoIndent,
    autoClose: s.autoClose,
    hideGuide: s.hideGuide,
    idleTimeoutMs: s.idleSec * 1000,
  };
}

/** What gets stored with the result so that tests can be filtered and compared. */
export function metaFor(s: PracticeSettings, source: ResolvedSource): TestMeta {
  return {
    testType: s.testType,
    sourceId: source.id,
    sourceName: source.name,
    language: source.language,
    mode: s.mode,
    comments: s.comments,
    errorPolicy: s.errorPolicy,
    timeLimitMs: s.testType === 'timed' ? s.durationSec * 1000 : undefined,
    ...(s.hideGuide && { hideGuide: true }),
  };
}
