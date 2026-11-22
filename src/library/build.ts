import type { Library, RawFile, RefFile, TreeNode } from './types';

/** Extensions that are treated as practice material, with the engine language and display name. */
export const LANGUAGES: Record<string, { language: string; name: string }> = {
  cpp: { language: 'cpp', name: 'C++' },
  cc: { language: 'cpp', name: 'C++' },
  cxx: { language: 'cpp', name: 'C++' },
  'c++': { language: 'cpp', name: 'C++' },
  h: { language: 'cpp', name: 'C++' },
  hpp: { language: 'cpp', name: 'C++' },
  c: { language: 'cpp', name: 'C' },
  py: { language: 'plaintext', name: 'Python' },
  java: { language: 'plaintext', name: 'Java' },
  kt: { language: 'plaintext', name: 'Kotlin' },
  rs: { language: 'plaintext', name: 'Rust' },
  go: { language: 'plaintext', name: 'Go' },
  js: { language: 'plaintext', name: 'JavaScript' },
  ts: { language: 'plaintext', name: 'TypeScript' },
  cs: { language: 'plaintext', name: 'C#' },
  txt: { language: 'plaintext', name: 'Texto' },
};

export const MAX_FILE_BYTES = 200_000;
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.vscode', '.idea', '__pycache__', 'dist', 'build']);

export const normalizePath = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\/+/, '').replace(/\/{2,}/g, '/');

export function extOf(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

const isIgnored = (path: string) => path.split('/').some((part) => IGNORED_DIRS.has(part) || (part.startsWith('.') && part.length > 1));

/** Drops a single top-level folder shared by every path (the selected folder itself). */
export function stripCommonRoot(paths: string[]): { root: string; strip: (p: string) => string } {
  const first = paths[0]?.split('/')[0];
  if (!first || paths.length === 0 || !paths.every((p) => p.startsWith(`${first}/`))) return { root: '', strip: (p) => p };
  return { root: first, strip: (p) => p.slice(first.length + 1) };
}

/**
 * Builds the library from raw files: keeps supported source files of reasonable
 * size, skips binaries and empty files, and sorts by path. No rigid folder
 * structure is assumed.
 */
export async function buildLibrary(raw: readonly RawFile[], name: string, now = Date.now()): Promise<Library> {
  const skipped = { tooLarge: 0, unsupported: 0, binary: 0, empty: 0 };
  const normalized = raw.map((f) => ({ ...f, path: normalizePath(f.path) })).filter((f) => f.path && !isIgnored(f.path));
  const { root, strip } = stripCommonRoot(normalized.map((f) => f.path));
  const files: RefFile[] = [];
  const seen = new Set<string>();
  for (const f of normalized) {
    const path = strip(f.path);
    const ext = extOf(path);
    const lang = LANGUAGES[ext];
    if (!lang) {
      skipped.unsupported++;
      continue;
    }
    if (f.size > MAX_FILE_BYTES) {
      skipped.tooLarge++;
      continue;
    }
    if (seen.has(path)) continue;
    const text = (await f.read()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.includes('\u0000')) {
      skipped.binary++;
      continue;
    }
    if (!text.trim()) {
      skipped.empty++;
      continue;
    }
    seen.add(path);
    const slash = path.lastIndexOf('/');
    files.push({
      path,
      name: path.slice(slash + 1),
      dir: slash >= 0 ? path.slice(0, slash) : '',
      ext,
      language: lang.language,
      languageName: lang.name,
      text,
      lines: text.replace(/\n+$/, '').split('\n').length,
      chars: text.length,
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path, 'es', { numeric: true, sensitivity: 'base' }));
  return { name: root || name, importedAt: now, files, skipped };
}

export function buildTree(files: readonly RefFile[]): TreeNode {
  const root: TreeNode = { name: '', path: '', folders: [], files: [], total: 0 };
  for (const f of files) {
    let node = root;
    node.total++;
    if (f.dir) {
      for (const part of f.dir.split('/')) {
        const path = node.path ? `${node.path}/${part}` : part;
        let child = node.folders.find((x) => x.name === part);
        if (!child) {
          child = { name: part, path, folders: [], files: [], total: 0 };
          node.folders.push(child);
        }
        child.total++;
        node = child;
      }
    }
    node.files.push(f);
  }
  return root;
}

export type LengthFilter = 'any' | 'short' | 'medium' | 'long';
export const LENGTH_RANGES: Record<Exclude<LengthFilter, 'any'>, [number, number]> = { short: [1, 30], medium: [31, 80], long: [81, Infinity] };

export interface FileQuery {
  text?: string;
  /** Language display name, e.g. `C++`. */
  language?: string;
  /** Only files inside this folder (and subfolders). */
  folder?: string;
  length?: LengthFilter;
}

const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Filters files; the text query matches every word against the path (accents and case ignored). */
export function filterFiles(files: readonly RefFile[], q: FileQuery): RefFile[] {
  const words = fold(q.text ?? '').split(/\s+/).filter(Boolean);
  const range = q.length && q.length !== 'any' ? LENGTH_RANGES[q.length] : null;
  return files.filter((f) => {
    if (q.language && f.languageName !== q.language) return false;
    if (q.folder && f.dir !== q.folder && !f.dir.startsWith(`${q.folder}/`)) return false;
    if (range && (f.lines < range[0] || f.lines > range[1])) return false;
    const hay = fold(f.path);
    return words.every((w) => hay.includes(w));
  });
}

export const languagesOf = (files: readonly RefFile[]): string[] => [...new Set(files.map((f) => f.languageName))].sort();

export function pickRandomFile(files: readonly RefFile[], rand: () => number, avoidPath?: string): RefFile | undefined {
  const pool = files.length > 1 ? files.filter((f) => f.path !== avoidPath) : files;
  return pool[Math.floor(rand() * pool.length)];
}
