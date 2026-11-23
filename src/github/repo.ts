import { buildLibrary, extOf, isIgnored, LANGUAGES, MAX_FILE_BYTES, type Library, type RawFile } from '../library';
import { GitHubError, segment, type GitHubClient } from './client';

export interface RepoSpec {
  owner: string;
  repo: string;
  /** Branch, tag or commit; the default branch when empty. */
  ref: string;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO_RE = /^[A-Za-z0-9._-]{1,100}$/;
const REF_RE = /^[A-Za-z0-9._/-]{1,255}$/;

export const isValidRef = (ref: string) => ref === '' || (REF_RE.test(ref) && !ref.includes('..') && !ref.startsWith('/') && !ref.endsWith('/') && !ref.includes('//'));

/**
 * Accepts `owner/repo`, `owner/repo@ref` or a github.com URL (optionally `/tree/<ref>`).
 * Anything else, including other hosts, returns null.
 */
export function parseRepo(input: string, ref = ''): RepoSpec | null {
  let s = input.trim();
  let urlRef = '';
  if (/^https?:\/\//i.test(s) || /^github\.com\//i.test(s)) {
    let url: URL;
    try {
      url = new URL(s.replace(/^github\.com\//i, 'https://github.com/'));
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') || url.username || url.password || url.port) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    if (parts.length > 2 && parts[2] !== 'tree') return null;
    if (parts[2] === 'tree') {
      if (parts.length !== 4) return null;
      urlRef = decodeURIComponent(parts[3]);
    }
    s = `${parts[0]}/${parts[1]}`;
  } else {
    const at = s.indexOf('@');
    if (at >= 0) {
      urlRef = s.slice(at + 1);
      s = s.slice(0, at);
    }
  }
  const m = /^([^/]+)\/([^/]+?)(?:\.git)?$/.exec(s);
  if (!m) return null;
  const [, owner, repo] = m;
  const finalRef = ref.trim() || urlRef;
  if (!OWNER_RE.test(owner) || !REPO_RE.test(repo) || repo === '.' || repo === '..' || !isValidRef(finalRef)) return null;
  return { owner, repo, ref: finalRef };
}

export const repoLabel = (spec: RepoSpec) => `${spec.owner}/${spec.repo}${spec.ref ? `@${spec.ref}` : ''}`;

/** Without a token GitHub allows 60 requests per hour, so far fewer files are downloaded. */
export const MAX_FILES = { token: 500, anonymous: 50 };
const CONCURRENCY = 6;

interface TreeEntry {
  path: string;
  type: string;
  sha: string;
  size?: number;
}

export interface RepoLoad {
  library: Library;
  spec: RepoSpec;
  isPrivate: boolean;
  /** GitHub cut the file list short (very large repository). */
  truncated: boolean;
  /** Code files left out because of the download limit. */
  capped: number;
}

/** Plain text files (`.txt`) are references locally, but in a repository they are rarely code. */
const isCode = (path: string) => extOf(path) !== 'txt' && !!LANGUAGES[extOf(path)] && !isIgnored(path);
const SHA_RE = /^[0-9a-f]{40}$/;

/** Downloads only the supported code files of a repository, straight into memory. */
export async function loadRepo(
  client: GitHubClient,
  spec: RepoSpec,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<RepoLoad> {
  const base = `/repos/${segment(spec.owner)}/${segment(spec.repo)}`;
  const info = await client.json<{ default_branch?: unknown; private?: unknown }>(base, opts.signal);
  const ref = spec.ref || (typeof info.default_branch === 'string' && isValidRef(info.default_branch) ? info.default_branch : '');
  if (!ref) throw new GitHubError('invalid');
  const tree = await client.json<{ tree?: unknown; truncated?: unknown }>(`${base}/git/trees/${ref.split('/').map(segment).join('/')}?recursive=1`, opts.signal);
  if (!Array.isArray(tree.tree)) throw new GitHubError('invalid');

  const code = (tree.tree as TreeEntry[]).filter(
    (e) => e && e.type === 'blob' && typeof e.path === 'string' && typeof e.sha === 'string' && SHA_RE.test(e.sha) && isCode(e.path) && (e.size ?? 0) <= MAX_FILE_BYTES && (e.size ?? 1) > 0,
  );
  const limit = client.authenticated ? MAX_FILES.token : MAX_FILES.anonymous;
  const chosen = code.slice(0, limit);

  const texts = new Map<string, string>();
  let done = 0;
  opts.onProgress?.(0, chosen.length);
  const queue = [...chosen];
  const worker = async () => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const text = await client.text(`${base}/git/blobs/${e.sha}`, opts.signal);
      if (text.length > MAX_FILE_BYTES) throw new GitHubError('tooLarge');
      texts.set(e.path, text);
      opts.onProgress?.(++done, chosen.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chosen.length) }, worker));

  const raw: RawFile[] = chosen.map((e) => ({ path: e.path, size: e.size ?? 0, read: async () => texts.get(e.path) ?? '' }));
  const label = repoLabel({ ...spec, ref });
  // The repository, not its single top folder, names the library.
  const library = { ...(await buildLibrary(raw, label)), name: label };
  return { library, spec: { ...spec, ref }, isPrivate: info.private === true, truncated: tree.truncated === true, capped: code.length - chosen.length };
}

/** Repositories the token can read, most recently updated first. */
export async function listRepos(client: GitHubClient, signal?: AbortSignal): Promise<string[]> {
  const list = await client.json<unknown>('/user/repos?per_page=100&sort=updated', signal);
  if (!Array.isArray(list)) return [];
  return list.map((r: { full_name?: unknown }) => r?.full_name).filter((n): n is string => typeof n === 'string' && parseRepo(n) !== null);
}
