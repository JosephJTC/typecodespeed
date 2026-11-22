import type { Library } from './types';

/** What is remembered between visits. It stays in this browser's IndexedDB. */
export interface StoredLibrary {
  library: Library;
  /** Folder handle to re-read the folder later (only with the native picker). */
  handle?: FileSystemDirectoryHandle;
}

export interface LibraryStore {
  load(): Promise<StoredLibrary | null>;
  save(value: StoredLibrary): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryLibraryStore implements LibraryStore {
  private value: StoredLibrary | null = null;
  async load() {
    return this.value;
  }
  async save(value: StoredLibrary) {
    this.value = value;
  }
  async clear() {
    this.value = null;
  }
}

export const LIBRARY_DB_NAME = 'typecodespeed-referencias';
const STORE = 'library';
const KEY = 'current';

export class IndexedDbLibraryStore implements LibraryStore {
  private db?: Promise<IDBDatabase>;
  private readonly factory: IDBFactory;

  constructor(factory: IDBFactory = indexedDB) {
    this.factory = factory;
  }

  private open(): Promise<IDBDatabase> {
    return (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = this.factory.open(LIBRARY_DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  }

  private async run<T>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async load() {
    const value = await this.run<StoredLibrary | undefined>('readonly', (s) => s.get(KEY));
    return value && Array.isArray(value.library?.files) ? value : null;
  }
  async save(value: StoredLibrary) {
    await this.run('readwrite', (s) => s.put(value, KEY));
  }
  async clear() {
    await this.run('readwrite', (s) => s.delete(KEY));
  }
}

export function createLibraryStore(): LibraryStore {
  return typeof indexedDB === 'undefined' ? new MemoryLibraryStore() : new IndexedDbLibraryStore();
}
