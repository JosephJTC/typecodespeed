import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { exportHistory, IndexedDbHistoryStore, isTestRecord, MemoryHistoryStore, parseHistory, type HistoryStore } from '../store';
import { quickRecord } from './fixtures';

const a = quickRecord('ab;', 'ab;', { id: 'a', finishedAt: 100 });
const b = quickRecord('abc;', 'ax<bc;', { id: 'b', finishedAt: 300 });
const c = quickRecord('x;', 'x', { id: 'c', finishedAt: 200 });

const stores: Array<[string, () => HistoryStore]> = [
  ['memoria', () => new MemoryHistoryStore()],
  ['IndexedDB', () => new IndexedDbHistoryStore(new IDBFactory())],
];

describe.each(stores)('historial en %s', (_name, make) => {
  it('guarda, lista del más reciente al más antiguo y conserva los datos íntegros', async () => {
    const store = make();
    expect(await store.list()).toEqual([]);
    await store.add(a);
    await store.add(b);
    await store.add(c);
    const list = await store.list();
    expect(list.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(list[0]).toEqual(b);
  });

  it('guardar dos veces el mismo id no duplica', async () => {
    const store = make();
    await store.add(a);
    await store.add({ ...a, wpm: 999 });
    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].wpm).toBe(999);
  });

  it('elimina una prueba y borra todo', async () => {
    const store = make();
    await Promise.all([store.add(a), store.add(b), store.add(c)]);
    await store.remove('c');
    expect((await store.list()).map((r) => r.id)).toEqual(['b', 'a']);
    await store.remove('no-existe');
    await store.clear();
    expect(await store.list()).toEqual([]);
  });
});

describe('persistencia en IndexedDB', () => {
  it('los datos sobreviven al reabrir la base de datos', async () => {
    const factory = new IDBFactory();
    await new IndexedDbHistoryStore(factory).add(b);
    const reopened = await new IndexedDbHistoryStore(factory).list();
    expect(reopened).toEqual([b]);
  });

  it('ignora entradas con formato desconocido', async () => {
    const factory = new IDBFactory();
    const store = new IndexedDbHistoryStore(factory);
    await store.add(a);
    await store.add({ id: 'roto', version: 99 } as never);
    expect((await store.list()).map((r) => r.id)).toEqual(['a']);
  });
});

describe('exportar e importar', () => {
  it('ida y vuelta sin pérdida', () => {
    const { tests, skipped } = parseHistory(exportHistory([a, b]));
    expect(tests).toEqual([a, b]);
    expect(skipped).toBe(0);
  });

  it('rechaza archivos que no son un historial y omite entradas inválidas', () => {
    expect(() => parseHistory('{"foo":1}')).toThrow();
    expect(() => parseHistory('no es json')).toThrow();
    const file = JSON.parse(exportHistory([a]));
    file.tests.push({ id: 'x' }, null, { ...a, wpm: 'rápido' });
    expect(parseHistory(JSON.stringify(file))).toMatchObject({ tests: [a], skipped: 3 });
  });

  it('valida la estructura de un registro', () => {
    expect(isTestRecord(a)).toBe(true);
    expect(isTestRecord({ ...a, version: 0 })).toBe(false);
    expect(isTestRecord({ ...a, buckets: undefined })).toBe(false);
    expect(isTestRecord({ ...a, accuracy: Number.NaN })).toBe(false);
  });
});
