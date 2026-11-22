import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { buildLibrary, buildTree, extOf, filterFiles, languagesOf, MAX_FILE_BYTES, normalizePath, pickRandomFile } from '../build';
import { IndexedDbLibraryStore, MemoryLibraryStore } from '../store';
import type { RawFile } from '../types';
import { readZip, ZipError } from '../zip';

const raw = (path: string, text: string, size = text.length): RawFile => ({ path, size, read: async () => text });

const FILES = [
  raw('referencias/Grafos/BFS/bfs.cpp', 'int main() {\n  return 0;\n}\n'),
  raw('referencias/Grafos/BFS/notas.md', '# BFS'),
  raw('referencias/Grafos/dijkstra.cpp', 'a\n'.repeat(40)),
  raw('referencias/Estructuras/Árbol de segmentos/segtree.cpp', 'x\r\ny\r\n'),
  raw('referencias/Estructuras/dsu.py', 'def find(x):\n    return x\n'),
  raw('referencias/.git/config.txt', 'secreto'),
  raw('referencias/node_modules/x/index.js', 'x'),
  raw('referencias/grande.cpp', 'x', MAX_FILE_BYTES + 1),
  raw('referencias/binario.cpp', 'a\u0000b'),
  raw('referencias/vacio.cpp', '  \n'),
  raw('referencias/caso.in', '1 2 3'),
];

describe('construcción de la biblioteca', () => {
  it('conserva solo código fuente, sin la carpeta raíz, y cuenta lo omitido', async () => {
    const lib = await buildLibrary(FILES, 'x', 123);
    expect(lib.name).toBe('referencias');
    expect(lib.importedAt).toBe(123);
    expect(lib.files.map((f) => f.path)).toEqual([
      'Estructuras/Árbol de segmentos/segtree.cpp',
      'Estructuras/dsu.py',
      'Grafos/BFS/bfs.cpp',
      'Grafos/dijkstra.cpp',
    ]);
    expect(lib.skipped).toEqual({ tooLarge: 1, unsupported: 2, binary: 1, empty: 1 });
  });

  it('no lee los archivos que no va a usar', async () => {
    let reads = 0;
    const spy = (path: string, size = 1): RawFile => ({ path, size, read: async () => (reads++, 'x') });
    await buildLibrary([spy('a/foto.png'), spy('a/.env'), spy('a/enorme.cpp', MAX_FILE_BYTES + 1), spy('a/ok.cpp')], 'a');
    expect(reads).toBe(1);
  });

  it('normaliza saltos de línea y describe cada archivo', async () => {
    const lib = await buildLibrary(FILES, 'x');
    const seg = lib.files[0];
    expect(seg).toMatchObject({ name: 'segtree.cpp', dir: 'Estructuras/Árbol de segmentos', ext: 'cpp', language: 'cpp', languageName: 'C++', text: 'x\ny\n', lines: 2 });
    expect(lib.files[1]).toMatchObject({ language: 'plaintext', languageName: 'Python' });
  });

  it('acepta rutas de Windows y archivos sueltos sin carpeta', async () => {
    expect(normalizePath('ref\\Grafos\\bfs.cpp')).toBe('ref/Grafos/bfs.cpp');
    expect(normalizePath('./a//b.cpp')).toBe('a/b.cpp');
    expect(extOf('a.b/Makefile')).toBe('');
    expect(extOf('a/b.CPP')).toBe('cpp');
    const lib = await buildLibrary([raw('a.cpp', 'x'), raw('b.cpp', 'y')], 'Sueltos');
    expect(lib.name).toBe('Sueltos');
    expect(lib.files.map((f) => f.dir)).toEqual(['', '']);
  });
});

describe('exploración', () => {
  it('arma el árbol de carpetas con totales', async () => {
    const tree = buildTree((await buildLibrary(FILES, 'x')).files);
    expect(tree.total).toBe(4);
    expect(tree.folders.map((f) => [f.name, f.total])).toEqual([['Estructuras', 2], ['Grafos', 2]]);
    const grafos = tree.folders[1];
    expect(grafos.files.map((f) => f.name)).toEqual(['dijkstra.cpp']);
    expect(grafos.folders[0]).toMatchObject({ name: 'BFS', path: 'Grafos/BFS', total: 1 });
  });

  it('busca sin distinguir acentos ni mayúsculas, y filtra por lenguaje, carpeta y tamaño', async () => {
    const { files } = await buildLibrary(FILES, 'x');
    expect(filterFiles(files, { text: 'arbol SEG' }).map((f) => f.name)).toEqual(['segtree.cpp']);
    expect(filterFiles(files, { text: 'grafos bfs' }).map((f) => f.name)).toEqual(['bfs.cpp']);
    expect(filterFiles(files, { language: 'Python' }).map((f) => f.name)).toEqual(['dsu.py']);
    expect(filterFiles(files, { folder: 'Grafos' })).toHaveLength(2);
    expect(filterFiles(files, { folder: 'Graf' })).toHaveLength(0);
    expect(filterFiles(files, { length: 'medium' }).map((f) => f.name)).toEqual(['dijkstra.cpp']);
    expect(filterFiles(files, { length: 'short' })).toHaveLength(3);
    expect(filterFiles(files, {})).toHaveLength(4);
    expect(languagesOf(files)).toEqual(['C++', 'Python']);
  });

  it('elige un archivo al azar distinto del anterior', async () => {
    const { files } = await buildLibrary(FILES, 'x');
    for (let i = 0; i < 20; i++) expect(pickRandomFile(files, Math.random, files[0].path)!.path).not.toBe(files[0].path);
    expect(pickRandomFile([files[0]], () => 0, files[0].path)).toBe(files[0]);
    expect(pickRandomFile([], () => 0)).toBeUndefined();
  });
});

/** Builds a ZIP archive in memory. */
async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function makeZip(entries: Array<{ path: string; text: string; deflate?: boolean }>): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = enc.encode(e.path);
    const plain = enc.encode(e.text);
    const data = e.deflate ? await deflateRaw(plain) : plain;
    const local = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, e.deflate ? 8 : 0, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, plain.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, e.deflate ? 8 : 0, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, plain.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const dirSize = centrals.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, dirSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + dirSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, p);
    p += part.length;
  }
  return out.buffer;
}

describe('importación desde ZIP', () => {
  it('lee entradas comprimidas y sin comprimir, con nombres UTF-8', async () => {
    const code = 'int main() {\n  return 0; // ñ\n}\n'.repeat(20);
    const zip = await makeZip([
      { path: 'referencias/', text: '' },
      { path: 'referencias/Árboles/trie.cpp', text: code, deflate: true },
      { path: 'referencias/dsu.cpp', text: 'struct DSU {};\n' },
      { path: 'referencias/imagen.png', text: 'x' },
    ]);
    const lib = await buildLibrary(readZip(zip), 'archivo');
    expect(lib.name).toBe('referencias');
    expect(lib.files.map((f) => f.path)).toEqual(['Árboles/trie.cpp', 'dsu.cpp']);
    expect(lib.files[0].text).toBe(code);
    expect(lib.files[1].text).toBe('struct DSU {};\n');
  });

  it('rechaza archivos que no son ZIP', () => {
    expect(() => readZip(new TextEncoder().encode('esto no es un zip, solo texto largo').buffer as ArrayBuffer)).toThrow(ZipError);
    expect(() => readZip(new ArrayBuffer(4))).toThrow(ZipError);
  });
});

describe('almacén local de la biblioteca', () => {
  it.each([
    ['memoria', () => new MemoryLibraryStore()],
    ['IndexedDB', () => new IndexedDbLibraryStore(new IDBFactory())],
  ])('guarda, carga y borra en %s', async (_n, make) => {
    const store = make();
    expect(await store.load()).toBeNull();
    const library = await buildLibrary(FILES, 'x', 5);
    await store.save({ library });
    expect((await store.load())!.library).toEqual(library);
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  it('la biblioteca sobrevive al reabrir la base de datos', async () => {
    const factory = new IDBFactory();
    const library = await buildLibrary(FILES, 'x', 5);
    await new IndexedDbLibraryStore(factory).save({ library });
    expect((await new IndexedDbLibraryStore(factory).load())!.library.files).toHaveLength(4);
  });
});
