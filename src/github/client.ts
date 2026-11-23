/**
 * The only module of the application that opens network connections, and only
 * to the GitHub REST API: read-only GET requests with no body, no cookies and
 * no referrer. The token, when given, travels only in the Authorization header.
 */
export const API_ORIGIN = 'https://api.github.com';

export type GitHubErrorKind = 'auth' | 'notFound' | 'rateLimit' | 'network' | 'tooLarge' | 'invalid';

export class GitHubError extends Error {
  readonly kind: GitHubErrorKind;
  /** Unix seconds when the rate limit resets (rateLimit only). */
  readonly resetAt?: number;
  constructor(kind: GitHubErrorKind, resetAt?: number) {
    super(kind);
    this.name = 'GitHubError';
    this.kind = kind;
    this.resetAt = resetAt;
  }
}

export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export interface GitHubClient {
  readonly authenticated: boolean;
  json<T>(path: string, signal?: AbortSignal): Promise<T>;
  text(path: string, signal?: AbortSignal): Promise<string>;
}

/** Path segments must not be able to change the endpoint (`..`, `?`, `#`, `/`). */
export const segment = (s: string) => encodeURIComponent(s);

/**
 * `token` must already be validated (`isValidToken`). `fetchImpl` is injectable
 * for tests; by default the browser `fetch`.
 */
export function createGitHubClient(token: string | null, fetchImpl: Fetch = (u, i) => fetch(u, i)): GitHubClient {
  async function request(path: string, accept: string, signal?: AbortSignal): Promise<Response> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new GitHubError('invalid');
    const url = new URL(path, API_ORIGIN);
    if (url.origin !== API_ORIGIN) throw new GitHubError('invalid');
    const headers: Record<string, string> = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetchImpl(url.href, {
        method: 'GET',
        headers,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        redirect: 'error',
        mode: 'cors',
        signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new GitHubError('network');
    }
    if (res.ok) return res;
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (res.status === 429 || (res.status === 403 && remaining === '0')) {
      throw new GitHubError('rateLimit', Number(res.headers.get('x-ratelimit-reset')) || undefined);
    }
    if (res.status === 401) throw new GitHubError('auth');
    // GitHub answers 404 for private repositories the token cannot see.
    if (res.status === 404 || res.status === 403) throw new GitHubError('notFound');
    throw new GitHubError('network');
  }
  return {
    authenticated: !!token,
    json: async <T>(path: string, signal?: AbortSignal) => (await request(path, 'application/vnd.github+json', signal)).json() as Promise<T>,
    text: async (path: string, signal?: AbortSignal) => (await request(path, 'application/vnd.github.raw+json', signal)).text(),
  };
}
