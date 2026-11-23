import { describe, expect, it } from 'vitest';
import type { Library, RefFile } from '../../../library';
import { DEFAULT_SETTINGS, ghPrefix, parseSettings, resolveSource } from '../config';

const file = (path: string, text = 'int x;\n'): RefFile => ({ path, name: path.split('/').pop()!, dir: path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '', ext: 'cpp', language: 'cpp', languageName: 'C++', text, lines: 1, chars: text.length });
const repo: Library = { name: 'ana/refs@main', importedAt: 0, files: [file('grafos/dfs.cpp'), file('ds/seg.cpp')], skipped: { tooLarge: 0, unsupported: 0, binary: 0, empty: 0 } };
const names = { all: 'all', custom: 'custom' };
const local = [file('grafos/dfs.cpp', 'local\n')];

describe('origen GitHub en la práctica', () => {
  it('resuelve un archivo del repositorio sin mezclarlo con las referencias locales', () => {
    const s = { ...DEFAULT_SETTINGS, source: 'gh', ghPath: 'grafos/dfs.cpp' };
    const src = resolveSource(s, local, names, Math.random, undefined, repo);
    expect(src?.id).toBe(`${ghPrefix(repo.name)}grafos/dfs.cpp`);
    expect(src?.codes).toEqual(['int x;\n']);
    expect(resolveSource({ ...s, source: 'ref', refPath: 'grafos/dfs.cpp' }, local, names, Math.random, undefined, repo)?.codes).toEqual(['local\n']);
  });

  it('sin repositorio cargado no hay código', () => {
    expect(resolveSource({ ...DEFAULT_SETTINGS, source: 'gh', ghPath: 'grafos/dfs.cpp' }, local, names)).toBeNull();
    expect(resolveSource({ ...DEFAULT_SETTINGS, source: 'ghRandom' }, local, names)).toBeNull();
  });

  it('al azar evita repetir el anterior y respeta los filtros', () => {
    const s = { ...DEFAULT_SETTINGS, source: 'ghRandom', ghQuery: { text: 'ds' } };
    expect(resolveSource(s, local, names, () => 0, undefined, repo)?.id).toBe(`${ghPrefix(repo.name)}ds/seg.cpp`);
    const prev = `${ghPrefix(repo.name)}grafos/dfs.cpp`;
    expect(resolveSource({ ...s, ghQuery: {} }, local, names, () => 0, prev, repo)?.id).toBe(`${ghPrefix(repo.name)}ds/seg.cpp`);
  });

  it('las rutas del repositorio no se restauran al recargar', () => {
    const s = parseSettings(JSON.stringify({ ...DEFAULT_SETTINGS, source: 'gh', ghPath: 'secreto/a.cpp', ghQuery: { text: 'x' } }));
    expect(s.source).toBe(DEFAULT_SETTINGS.source);
    expect(s.ghPath).toBe('');
    expect(s.ghQuery).toEqual({});
  });
});
