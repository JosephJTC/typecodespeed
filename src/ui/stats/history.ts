import { useCallback, useEffect, useState } from 'react';
import { createHistoryStore, type HistoryStore, type TestRecord } from '../../stats';

let current = createHistoryStore();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Replaces the store (tests, or a fallback when IndexedDB fails). */
export function setHistoryStore(store: HistoryStore, persistent = true) {
  current = { store, persistent };
  notify();
}

export async function saveRecord(record: TestRecord): Promise<void> {
  await current.store.add(record);
  notify();
}

export interface History {
  /** null while loading. */
  records: TestRecord[] | null;
  /** The history could not be read or written. */
  failed: boolean;
  /** false when the browser has no IndexedDB and the history only lives in memory. */
  persistent: boolean;
  remove: (id: string) => Promise<void>;
  clear: () => Promise<void>;
  addAll: (records: TestRecord[]) => Promise<void>;
}

export function useHistory(): History {
  const [records, setRecords] = useState<TestRecord[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      current.store.list().then(
        (list) => alive && (setRecords(list), setFailed(false)),
        () => alive && (setRecords([]), setFailed(true)),
      );
    void load();
    listeners.add(load);
    return () => {
      alive = false;
      listeners.delete(load);
    };
  }, []);

  const run = useCallback(async (op: (s: HistoryStore) => Promise<void>) => {
    try {
      await op(current.store);
    } catch {
      setFailed(true);
    }
    notify();
  }, []);

  return {
    records,
    failed,
    persistent: current.persistent,
    remove: useCallback((id: string) => run((s) => s.remove(id)), [run]),
    clear: useCallback(() => run((s) => s.clear()), [run]),
    addAll: useCallback((list: TestRecord[]) => run(async (s) => { for (const r of list) await s.add(r); }), [run]),
  };
}
