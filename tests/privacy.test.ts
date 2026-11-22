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

const NETWORK_APIS = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.serviceWorker|\bimportScripts\b|https?:\/\//;

describe('privacidad', () => {
  it('el código de la aplicación no usa ninguna API de red ni URL externa', () => {
    const files = sources('src');
    expect(files.length).toBeGreaterThan(30);
    const offenders = files.filter((f) => NETWORK_APIS.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('la página publicada prohíbe conexiones de red', () => {
    const config = readFileSync('vite.config.ts', 'utf8');
    expect(config).toContain("connect-src 'none'");
    expect(config).toContain("default-src 'self'");
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
