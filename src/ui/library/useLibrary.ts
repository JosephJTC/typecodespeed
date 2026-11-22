import { useCallback, useEffect, useState } from 'react';
import { createLibraryStore, ensureReadPermission, libraryFromDirectory, libraryFromFiles, libraryFromZip, pickDirectory, type Library, type LibraryStore, type StoredLibrary } from '../../library';

let store: LibraryStore = createLibraryStore();
/** Replaces the store (tests). */
export function setLibraryStore(next: LibraryStore) {
  store = next;
}

export type LibraryError = 'read' | 'zip' | 'permission' | 'empty';

export interface LibraryState {
  /** undefined while loading, null when nothing has been imported. */
  library: Library | null | undefined;
  /** The folder can be re-read without picking it again. */
  canRefresh: boolean;
  busy: boolean;
  error: LibraryError | null;
  pickFolder: () => Promise<void>;
  importFiles: (files: File[], fallbackName: string) => Promise<void>;
  importZip: (file: File) => Promise<void>;
  refresh: () => Promise<void>;
  forget: () => Promise<void>;
}

/** The user's local reference library: imported, kept and read only inside this browser. */
export function useLibrary(): LibraryState {
  const [stored, setStored] = useState<StoredLibrary | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LibraryError | null>(null);

  useEffect(() => {
    let alive = true;
    store.load().then(
      (v) => alive && setStored(v),
      () => alive && setStored(null),
    );
    return () => {
      alive = false;
    };
  }, []);

  const run = useCallback(async (kind: LibraryError, load: () => Promise<StoredLibrary | null>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await load();
      if (!next) return;
      if (next.library.files.length === 0) {
        setError('empty');
        return;
      }
      setStored(next);
      // The handle cannot be cloned in every browser; the library itself is what matters.
      await store.save(next).catch(() => store.save({ library: next.library }).catch(() => {}));
    } catch {
      setError(kind);
    } finally {
      setBusy(false);
    }
  }, []);

  const handle = stored?.handle;
  return {
    library: stored === undefined ? undefined : (stored?.library ?? null),
    canRefresh: !!handle,
    busy,
    error,
    pickFolder: useCallback(
      () =>
        run('read', async () => {
          const dir = await pickDirectory();
          return dir ? { library: await libraryFromDirectory(dir), handle: dir } : null;
        }),
      [run],
    ),
    importFiles: useCallback((files: File[], name: string) => run('read', async () => (files.length ? { library: await libraryFromFiles(files, name) } : null)), [run]),
    importZip: useCallback((file: File) => run('zip', async () => ({ library: await libraryFromZip(file) })), [run]),
    refresh: useCallback(
      () =>
        run('permission', async () => {
          if (!handle) return null;
          if (!(await ensureReadPermission(handle))) throw new Error('denied');
          return { library: await libraryFromDirectory(handle), handle };
        }),
      [run, handle],
    ),
    forget: useCallback(async () => {
      setStored(null);
      setError(null);
      await store.clear().catch(() => {});
    }, []),
  };
}
