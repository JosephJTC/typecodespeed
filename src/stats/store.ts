import { RECORD_VERSION, type TestRecord } from './types';

/** Local history of finished tests. Nothing ever leaves the browser. */
export interface HistoryStore {
  list(): Promise<TestRecord[]>;
  add(record: TestRecord): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryHistoryStore implements HistoryStore {
  private records = new Map<string, TestRecord>();
  async list() {
    return sortNewestFirst([...this.records.values()]);
  }
  async add(record: TestRecord) {
    this.records.set(record.id, structuredClone(record));
  }
  async remove(id: string) {
    this.records.delete(id);
  }
  async clear() {
    this.records.clear();
  }
}

const sortNewestFirst = (records: TestRecord[]) => records.sort((a, b) => b.finishedAt - a.finishedAt);

export const DB_NAME = 'typecodespeed';
const DB_VERSION = 1;
const STORE = 'tests';

const request = <T,>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export class IndexedDbHistoryStore implements HistoryStore {
  private db?: Promise<IDBDatabase>;
  private readonly factory: IDBFactory;
  private readonly name: string;

  constructor(factory: IDBFactory = indexedDB, name = DB_NAME) {
    this.factory = factory;
    this.name = name;
  }

  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = this.factory.open(this.name, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('finishedAt', 'finishedAt');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('blocked'));
    }));
  }

  private async tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    const tx = db.transaction(STORE, mode);
    const result = await request(run(tx.objectStore(STORE)));
    if (mode === 'readwrite') {
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    }
    return result;
  }

  async list() {
    const all = await this.tx('readonly', (s) => s.getAll() as IDBRequest<TestRecord[]>);
    return sortNewestFirst(all.filter(isTestRecord));
  }
  async add(record: TestRecord) {
    await this.tx('readwrite', (s) => s.put(record));
  }
  async remove(id: string) {
    await this.tx('readwrite', (s) => s.delete(id));
  }
  async clear() {
    await this.tx('readwrite', (s) => s.clear());
  }
}

/** IndexedDB when the browser offers it, otherwise an in-memory history that lasts until the page is closed. */
export function createHistoryStore(): { store: HistoryStore; persistent: boolean } {
  try {
    if (typeof indexedDB !== 'undefined') return { store: new IndexedDbHistoryStore(), persistent: true };
  } catch {
    // Some privacy modes throw on access.
  }
  return { store: new MemoryHistoryStore(), persistent: false };
}

const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Structural check used for stored data and imported files. */
export function isTestRecord(x: unknown): x is TestRecord {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    r.version === RECORD_VERSION &&
    typeof r.id === 'string' &&
    r.id.length > 0 &&
    typeof r.testType === 'string' &&
    typeof r.sourceName === 'string' &&
    typeof r.mode === 'string' &&
    ['finishedAt', 'durationMs', 'wpm', 'rawWpm', 'cps', 'accuracy', 'completion', 'consistency', 'correctChars', 'keystrokes', 'evaluated', 'errorsMade', 'uncorrected', 'corrections', 'bucketMs'].every((k) => isNumber(r[k])) &&
    Array.isArray(r.buckets) &&
    Array.isArray(r.confusions) &&
    typeof r.chars === 'object' && r.chars !== null &&
    typeof r.tokenTypes === 'object' && r.tokenTypes !== null &&
    typeof r.charClasses === 'object' && r.charClasses !== null &&
    typeof r.errorsByKind === 'object' && r.errorsByKind !== null
  );
}

export interface ExportFile {
  app: 'typecodespeed';
  version: number;
  exportedAt: number;
  tests: TestRecord[];
}

export function exportHistory(records: readonly TestRecord[], now = Date.now()): string {
  const file: ExportFile = { app: 'typecodespeed', version: RECORD_VERSION, exportedAt: now, tests: [...records] };
  return JSON.stringify(file);
}

/** Parses an exported file. Throws when it is not a TypeCodeSpeed history; invalid entries are skipped and counted. */
export function parseHistory(json: string): { tests: TestRecord[]; skipped: number } {
  const data: unknown = JSON.parse(json);
  if (typeof data !== 'object' || data === null || (data as ExportFile).app !== 'typecodespeed' || !Array.isArray((data as ExportFile).tests)) {
    throw new Error('invalid history file');
  }
  const all = (data as ExportFile).tests as unknown[];
  const tests = all.filter(isTestRecord);
  return { tests, skipped: all.length - tests.length };
}
