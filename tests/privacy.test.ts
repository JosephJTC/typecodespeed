import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every non-test source file of the application. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const NETWORK_APIS = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.serviceWorker|\bimportScripts\b/;
const URLS = /https?:\/\/[^\s'"`)]*/g;
/** The only module allowed to open connections, and only to the GitHub API. */
const GITHUB_CLIENT = join('src', 'github', 'client.ts');
/** The API, plus github.com pages the user may open or type (never a connection target). */
const allowedUrl = (u: string) => u === 'https://api.github.com' || u.startsWith('https://github.com/');

describe('privacidad', () => {
  it('solo el cliente de GitHub usa APIs de red', () => {
    const files = sources('src');
    expect(files.length).toBeGreaterThan(30);
    const offenders = files.filter((f) => f !== GITHUB_CLIENT && NETWORK_APIS.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
    expect(readFileSync(GITHUB_CLIENT, 'utf8')).toMatch(NETWORK_APIS);
  });

  it('el código no contiene URLs externas salvo la API de GitHub y páginas de github.com', () => {
    const found = sources('src').flatMap((f) => readFileSync(f, 'utf8').match(URLS) ?? []);
    expect([...new Set(found)].filter((u) => !allowedUrl(u))).toEqual([]);
  });

  it('el cliente de GitHub solo hace GET, sin cookies, sin referrer y sin seguir redirecciones', () => {
    const client = readFileSync(GITHUB_CLIENT, 'utf8');
    expect(client).toContain("method: 'GET'");
    expect(client).toContain("credentials: 'omit'");
    expect(client).toContain("referrerPolicy: 'no-referrer'");
    expect(client).toContain("redirect: 'error'");
    expect(client).not.toMatch(/\bbody\s*:/);
    expect(client).not.toMatch(/console\./);
  });

  it('las referencias locales no dependen del módulo de GitHub', () => {
    const local = sources(join('src', 'library'));
    expect(local.filter((f) => /from '\.\.\/github/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });

  it('ningún módulo escribe en la consola el token', () => {
    const offenders = sources('src').filter((f) => /console\.[a-z]+\([^)]*token/i.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('la página publicada solo permite conectarse a la API de GitHub', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    const policy = /CONTENT_SECURITY_POLICY =\s*"([^"]+)"/.exec(config)?.[1] ?? '';
    const directives = Object.fromEntries(policy.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
    expect(directives['connect-src']).toEqual(['https://api.github.com']);
    expect(directives['default-src']).toEqual(["'self'"]);
    expect(directives['form-action']).toEqual(["'none'"]);
    expect(directives['object-src']).toEqual(["'none'"]);
  });

  it('la carpeta de referencias está excluida del repositorio', () => {
    const ignore = readFileSync('.gitignore', 'utf8').split('\n');
    expect(ignore).toContain('referencias/');
  });

  it('no hay dependencias de producción aparte de React', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['react', 'react-dom']);
  });
});
