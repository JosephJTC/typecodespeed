import { useCallback, useRef, useState } from 'react';
import {
  createGitHubClient,
  forgetSealedToken,
  GitHubError,
  isValidToken,
  listRepos,
  loadRepo,
  loadSealedToken,
  MIN_PASSPHRASE,
  openToken,
  parseRepo,
  saveSealedToken,
  sealToken,
  type RepoLoad,
  type SealedToken,
} from '../../github';

export type GitHubErrorKey =
  | 'invalidRepo'
  | 'invalidToken'
  | 'shortPassphrase'
  | 'wrongPassphrase'
  | 'storage'
  | 'auth'
  | 'notFound'
  | 'rateLimit'
  | 'network'
  | 'tooLarge'
  | 'invalid'
  | 'empty';

export interface GitHubFailure {
  key: GitHubErrorKey;
  /** Unix seconds when the rate limit resets. */
  resetAt?: number;
}

export interface GitHubState {
  hasToken: boolean;
  tokenKind: 'fineGrained' | 'classic' | null;
  /** An encrypted token is saved in this browser. */
  sealed: boolean;
  repos: string[];
  repo: RepoLoad | null;
  busy: 'token' | 'repo' | null;
  progress: { done: number; total: number } | null;
  error: GitHubFailure | null;
  submitToken: (token: string, passphrase: string | null) => Promise<boolean>;
  unlock: (passphrase: string) => Promise<void>;
  forgetToken: () => void;
  open: (input: string, ref: string) => Promise<void>;
  cancel: () => void;
  close: () => void;
}

const failure = (e: unknown): GitHubFailure | null => {
  if (e instanceof DOMException && e.name === 'AbortError') return null;
  if (e instanceof GitHubError) return { key: e.kind, resetAt: e.resetAt };
  return { key: 'network' };
};

/**
 * GitHub access for the session. The token is kept in a ref (never rendered,
 * logged or put in a URL) and, only if the user asks, saved encrypted.
 */
export function useGitHub(): GitHubState {
  const token = useRef<string | null>(null);
  const [tokenKind, setTokenKind] = useState<GitHubState['tokenKind']>(null);
  const [sealed, setSealed] = useState<SealedToken | null>(() => {
    try {
      return loadSealedToken();
    } catch {
      return null;
    }
  });
  const [repos, setRepos] = useState<string[]>([]);
  const [repo, setRepo] = useState<RepoLoad | null>(null);
  const [busy, setBusy] = useState<GitHubState['busy']>(null);
  const [progress, setProgress] = useState<GitHubState['progress']>(null);
  const [error, setError] = useState<GitHubFailure | null>(null);
  const abort = useRef<AbortController | null>(null);

  const commit = useCallback((value: string, list: string[]) => {
    token.current = value;
    setTokenKind(value.startsWith('github_pat_') ? 'fineGrained' : 'classic');
    setRepos(list);
  }, []);

  /** Checks the token against GitHub; null when it was rejected (the error is set). */
  const check = useCallback(async (value: string): Promise<string[] | null> => {
    try {
      // Some tokens may read repositories but not list them (403/404): only 401 means invalid.
      return await listRepos(createGitHubClient(value)).catch((e: unknown) => {
        if (e instanceof GitHubError && e.kind === 'notFound') return [];
        throw e;
      });
    } catch (e) {
      setError(failure(e));
      return null;
    }
  }, []);

  const submitToken = useCallback(
    async (raw: string, passphrase: string | null) => {
      const value = raw.trim();
      setError(null);
      if (!isValidToken(value)) {
        setError({ key: 'invalidToken' });
        return false;
      }
      if (passphrase !== null && passphrase.length < MIN_PASSPHRASE) {
        setError({ key: 'shortPassphrase' });
        return false;
      }
      setBusy('token');
      try {
        const list = await check(value);
        if (!list) return false;
        if (passphrase !== null) {
          try {
            const next = await sealToken(value, passphrase);
            saveSealedToken(next);
            setSealed(next);
          } catch {
            setError({ key: 'storage' });
          }
        }
        commit(value, list);
        return true;
      } finally {
        setBusy(null);
      }
    },
    [check, commit],
  );

  const unlock = useCallback(
    async (passphrase: string) => {
      if (!sealed) return;
      setError(null);
      setBusy('token');
      try {
        const value = await openToken(sealed, passphrase);
        if (!value) {
          setError({ key: 'wrongPassphrase' });
          return;
        }
        const list = await check(value);
        if (list) commit(value, list);
      } finally {
        setBusy(null);
      }
    },
    [sealed, check, commit],
  );

  const forgetToken = useCallback(() => {
    abort.current?.abort();
    token.current = null;
    forgetSealedToken();
    setSealed(null);
    setTokenKind(null);
    setRepos([]);
    // A private repository must not stay readable once its token is forgotten.
    setRepo((r) => (r?.isPrivate ? null : r));
    setError(null);
  }, []);

  const open = useCallback(async (input: string, ref: string) => {
    setError(null);
    const spec = parseRepo(input, ref);
    if (!spec) {
      setError({ key: 'invalidRepo' });
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy('repo');
    setProgress(null);
    try {
      const loaded = await loadRepo(createGitHubClient(token.current), spec, {
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (loaded.library.files.length === 0) setError({ key: 'empty' });
      else setRepo(loaded);
    } catch (e) {
      setError(failure(e));
    } finally {
      if (abort.current === controller) {
        abort.current = null;
        setBusy(null);
        setProgress(null);
      }
    }
  }, []);

  return {
    hasToken: tokenKind !== null,
    tokenKind,
    sealed: !!sealed,
    repos,
    repo,
    busy,
    progress,
    error,
    submitToken,
    unlock,
    forgetToken,
    open,
    cancel: useCallback(() => {
      abort.current?.abort();
      abort.current = null;
      setBusy(null);
      setProgress(null);
    }, []),
    close: useCallback(() => {
      abort.current?.abort();
      setRepo(null);
    }, []),
  };
}
