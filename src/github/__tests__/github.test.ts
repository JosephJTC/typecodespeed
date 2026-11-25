import { describe, expect, it, vi } from 'vitest';
import { API_ORIGIN, createGitHubClient, GitHubError, type Fetch } from '../client';
import { listRepos, loadRepo, MAX_FILES, parseRepo } from '../repo';
import {
  forgetRememberedRawKey,
  forgetSealedToken,
  isFineGrained,
  isValidToken,
  loadRememberedRawKey,
  loadSealedToken,
  openToken,
  openTokenAndKey,
  openTokenWithRawKey,
  rememberRawKey,
  saveSealedToken,
  sealToken,
} from '../token';

const TOKEN = 'github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz';
const sha = (n: number) => n.toString(16).padStart(40, '0');

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

/** Fake GitHub: a repository with a tree and blob contents. */
function fakeGitHub(files: Record<string, string>, opts: { private?: boolean; requireToken?: boolean; sizes?: Record<string, number> } = {}) {
  const entries = Object.keys(files).map((path, i) => ({ path, type: 'blob', sha: sha(i + 1), size: opts.sizes?.[path] ?? files[path].length }));
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: Fetch = async (url, init) => {
    calls.push({ url, init });
    const auth = (init.headers as Record<string, string>).Authorization;
    if (opts.requireToken && auth !== `Bearer ${TOKEN}`) return json({ message: 'Not Found' }, 404);
    const path = new URL(url).pathname;
    if (path === '/repos/ana/refs') return json({ default_branch: 'main', private: !!opts.private });
    if (path === '/repos/ana/refs/git/trees/main') return json({ tree: [...entries, { path: 'src', type: 'tree', sha: sha(999) }], truncated: false });
    const blob = /\/git\/blobs\/([0-9a-f]{40})$/.exec(path);
    if (blob) {
      const e = entries.find((x) => x.sha === blob[1]);
      return e ? new Response(files[e.path]) : json({}, 404);
    }
    if (path === '/user/repos') return json([{ full_name: 'ana/refs' }, { full_name: 'bad name/x' }, { nope: 1 }]);
    return json({ message: 'Not Found' }, 404);
  };
  return { fetchImpl, calls };
}

describe('parseRepo', () => {
  it.each([
    ['ana/refs', { owner: 'ana', repo: 'refs', ref: '' }],
    ['  ana/refs.git ', { owner: 'ana', repo: 'refs', ref: '' }],
    ['ana/refs@dev', { owner: 'ana', repo: 'refs', ref: 'dev' }],
    ['https://github.com/ana/refs', { owner: 'ana', repo: 'refs', ref: '' }],
    ['github.com/ana/refs', { owner: 'ana', repo: 'refs', ref: '' }],
    ['https://github.com/ana/refs/tree/feature', { owner: 'ana', repo: 'refs', ref: 'feature' }],
  ])('acepta %s', (input, expected) => expect(parseRepo(input)).toEqual(expected));

  it.each([
    '',
    'ana',
    'ana/refs/extra',
    '../refs',
    'ana/..',
    'ana/re fs',
    'ana/refs?x=1',
    'ana/refs#a',
    'http://github.com/ana/refs',
    'https://evil.com/ana/refs',
    'https://github.com.evil.com/ana/refs',
    'https://user:pass@github.com/ana/refs',
    'https://github.com:8443/ana/refs',
    'https://github.com/ana/refs/blob/main/a.cpp',
    'ana/refs@../../user',
    'ana/refs@a//b',
    'javascript:alert(1)',
    '-ana/refs',
  ])('rechaza %s', (input) => expect(parseRepo(input)).toBeNull());

  it('la rama explícita tiene prioridad y también se valida', () => {
    expect(parseRepo('ana/refs@dev', 'main')?.ref).toBe('main');
    expect(parseRepo('ana/refs', '../x')).toBeNull();
  });
});

describe('token', () => {
  it('valida el formato y distingue los fine-grained', () => {
    expect(isValidToken(TOKEN)).toBe(true);
    expect(isFineGrained(TOKEN)).toBe(true);
    expect(isValidToken('ghp_' + 'a'.repeat(36))).toBe(true);
    expect(isFineGrained('ghp_' + 'a'.repeat(36))).toBe(false);
    expect(isValidToken('')).toBe(false);
    expect(isValidToken(`${TOKEN}\r\nX-Evil: 1`)).toBe(false);
    expect(isValidToken('Bearer ' + TOKEN)).toBe(false);
    expect(isValidToken('github_pat_short')).toBe(false);
  });

  it('se cifra y descifra con la contraseña correcta', async () => {
    const sealed = await sealToken(TOKEN, 'contraseña larga');
    expect(JSON.stringify(sealed)).not.toContain(TOKEN);
    expect(JSON.stringify(sealed)).not.toContain('contraseña');
    expect(await openToken(sealed, 'contraseña larga')).toBe(TOKEN);
    expect(await openToken(sealed, 'otra contraseña')).toBeNull();
  });

  it('cada cifrado usa sal e IV nuevos', async () => {
    const [a, b] = await Promise.all([sealToken(TOKEN, 'clave12345'), sealToken(TOKEN, 'clave12345')]);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });

  it('detecta datos alterados', async () => {
    const sealed = await sealToken(TOKEN, 'clave12345');
    const bytes = Uint8Array.from(atob(sealed.data), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    expect(await openToken({ ...sealed, data: btoa(String.fromCharCode(...bytes)) }, 'clave12345')).toBeNull();
  });

  it('la clave recordada abre el token sin la contraseña y muere con la pestaña', async () => {
    const sealed = await sealToken(TOKEN, 'contraseña larga');
    const opened = await openTokenAndKey(sealed, 'contraseña larga');
    expect(opened?.token).toBe(TOKEN);
    expect(await openTokenAndKey(sealed, 'otra contraseña')).toBeNull();
    expect(await openTokenWithRawKey(sealed, opened!.rawKey)).toBe(TOKEN);
    expect(await openTokenWithRawKey(sealed, btoa('0'.repeat(32)))).toBeNull();
    if (typeof sessionStorage !== 'undefined') {
      rememberRawKey(opened!.rawKey);
      expect(loadRememberedRawKey()).toBe(opened!.rawKey);
      forgetRememberedRawKey();
      expect(loadRememberedRawKey()).toBeNull();
    }
  });

  it('solo se guarda cifrado y se puede olvidar', async () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    saveSealedToken(await sealToken(TOKEN, 'clave12345'), storage);
    expect([...mem.values()].join()).not.toContain(TOKEN);
    expect(loadSealedToken(storage)).not.toBeNull();
    forgetSealedToken(storage);
    expect(loadSealedToken(storage)).toBeNull();
    mem.set('typecodespeed.github.token', '{"v":2}');
    expect(loadSealedToken(storage)).toBeNull();
  });
});

describe('cliente de GitHub', () => {
  it('solo hace GET sin cuerpo, sin cookies ni referrer, a api.github.com', async () => {
    const { fetchImpl, calls } = fakeGitHub({ 'a.cpp': 'int main() {}\n' });
    await loadRepo(createGitHubClient(TOKEN, fetchImpl), parseRepo('ana/refs')!);
    expect(calls.length).toBeGreaterThan(0);
    for (const { url, init } of calls) {
      expect(new URL(url).origin).toBe(API_ORIGIN);
      expect(init.method).toBe('GET');
      expect(init.body).toBeUndefined();
      expect(init.credentials).toBe('omit');
      expect(init.referrerPolicy).toBe('no-referrer');
      expect(init.redirect).toBe('error');
      expect(url).not.toContain(TOKEN);
    }
  });

  it('el token solo viaja en la cabecera Authorization', async () => {
    const { fetchImpl, calls } = fakeGitHub({ 'a.cpp': 'x' });
    await loadRepo(createGitHubClient(TOKEN, fetchImpl), parseRepo('ana/refs')!);
    expect(calls.every((c) => (c.init.headers as Record<string, string>).Authorization === `Bearer ${TOKEN}`)).toBe(true);
    const anon = fakeGitHub({ 'a.cpp': 'x' });
    await loadRepo(createGitHubClient(null, anon.fetchImpl), parseRepo('ana/refs')!);
    expect(anon.calls.some((c) => 'Authorization' in (c.init.headers as Record<string, string>))).toBe(false);
  });

  it('no acepta rutas que salgan de la API', async () => {
    const fetchImpl = vi.fn<Fetch>();
    const client = createGitHubClient(TOKEN, fetchImpl);
    await expect(client.json('//evil.com/x')).rejects.toThrow(GitHubError);
    await expect(client.json('https://evil.com/x')).rejects.toThrow(GitHubError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, {}, 'auth'],
    [404, {}, 'notFound'],
    [403, {}, 'notFound'],
    [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' }, 'rateLimit'],
    [429, {}, 'rateLimit'],
    [500, {}, 'network'],
  ] as const)('traduce el estado %i', async (status, headers, kind) => {
    const client = createGitHubClient(TOKEN, async () => json({ message: 'x' }, status, headers));
    await expect(client.json('/repos/ana/refs')).rejects.toMatchObject({ kind });
  });

  it('un fallo de red no expone el token', async () => {
    const client = createGitHubClient(TOKEN, async () => {
      throw new TypeError(`fallo con ${TOKEN}`);
    });
    const err = await client.json('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GitHubError);
    expect(String(err)).not.toContain(TOKEN);
    expect(JSON.stringify(err)).not.toContain(TOKEN);
  });
});

describe('loadRepo', () => {
  it('descarga solo archivos de código y arma carpetas que tienen código', async () => {
    const { fetchImpl, calls } = fakeGitHub({
      'README.md': '# hola',
      'docs/guia.txt': 'texto',
      'imagenes/logo.png': 'PNG',
      'grafos/dfs.cpp': 'void dfs() {}\n',
      'grafos/bfs.py': 'def bfs(): pass\n',
      'node_modules/x/index.js': 'x',
      '.github/workflows/ci.js': 'x',
      'ds/segtree.hpp': 'struct Seg {};\n',
    });
    const { library, isPrivate, capped } = await loadRepo(createGitHubClient(TOKEN, fetchImpl), parseRepo('ana/refs')!);
    expect(library.files.map((f) => f.path)).toEqual(['ds/segtree.hpp', 'grafos/bfs.py', 'grafos/dfs.cpp']);
    expect(library.name).toBe('ana/refs@main');
    expect(isPrivate).toBe(false);
    expect(capped).toBe(0);
    const blobs = calls.filter((c) => c.url.includes('/git/blobs/'));
    expect(blobs).toHaveLength(3);
  });

  it('lee repositorios privados con token y falla sin él', async () => {
    const gh = fakeGitHub({ 'a.cpp': 'int a;\n' }, { private: true, requireToken: true });
    const ok = await loadRepo(createGitHubClient(TOKEN, gh.fetchImpl), parseRepo('ana/refs')!);
    expect(ok.isPrivate).toBe(true);
    expect(ok.library.files).toHaveLength(1);
    await expect(loadRepo(createGitHubClient(null, gh.fetchImpl), parseRepo('ana/refs')!)).rejects.toMatchObject({ kind: 'notFound' });
  });

  it('no descarga archivos demasiado grandes ni vacíos', async () => {
    const { fetchImpl, calls } = fakeGitHub({ 'big.cpp': 'x', 'empty.cpp': '', 'ok.cpp': 'int x;' }, { sizes: { 'big.cpp': 10_000_000 } });
    const { library } = await loadRepo(createGitHubClient(TOKEN, fetchImpl), parseRepo('ana/refs')!);
    expect(library.files.map((f) => f.path)).toEqual(['ok.cpp']);
    expect(calls.filter((c) => c.url.includes('/git/blobs/'))).toHaveLength(1);
  });

  it('limita la descarga sin token', async () => {
    const files = Object.fromEntries(Array.from({ length: MAX_FILES.anonymous + 5 }, (_, i) => [`f${i}.cpp`, `int a${i};`]));
    const { library, capped } = await loadRepo(createGitHubClient(null, fakeGitHub(files).fetchImpl), parseRepo('ana/refs')!);
    expect(library.files).toHaveLength(MAX_FILES.anonymous);
    expect(capped).toBe(5);
  });

  it('rechaza respuestas malformadas', async () => {
    const client = createGitHubClient(TOKEN, async (url) => (url.includes('/git/trees/') ? json({ tree: 'nope' }) : json({ default_branch: 'main' })));
    await expect(loadRepo(client, parseRepo('ana/refs')!)).rejects.toMatchObject({ kind: 'invalid' });
    const badBranch = createGitHubClient(TOKEN, async () => json({ default_branch: '../../x' }));
    await expect(loadRepo(badBranch, parseRepo('ana/refs')!)).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('ignora entradas del árbol con SHA inválido', async () => {
    const calls: string[] = [];
    const client = createGitHubClient(TOKEN, async (url) => {
      calls.push(url);
      if (url.includes('/git/trees/')) return json({ tree: [{ path: 'a.cpp', type: 'blob', sha: '../../../user', size: 3 }] });
      return json({ default_branch: 'main' });
    });
    const { library } = await loadRepo(client, parseRepo('ana/refs')!);
    expect(library.files).toHaveLength(0);
    expect(calls.some((u) => u.includes('user'))).toBe(false);
  });

  it('lista repositorios válidos', async () => {
    expect(await listRepos(createGitHubClient(TOKEN, fakeGitHub({}).fetchImpl))).toEqual(['ana/refs']);
  });
});
