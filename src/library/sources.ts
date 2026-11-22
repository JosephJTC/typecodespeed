import { buildLibrary, extOf, LANGUAGES, MAX_FILE_BYTES } from './build';
import type { Library, RawFile } from './types';
import { readZip } from './zip';

/** Whether the browser offers the native folder picker (Chromium on desktop). */
export const canPickDirectory = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const fromFile = (file: File, path: string): RawFile => ({ path, size: file.size, read: () => file.text() });

/** Files chosen with `<input type="file" webkitdirectory>` or a plain multi-file input. */
export function libraryFromFiles(files: readonly File[], fallbackName: string): Promise<Library> {
  return buildLibrary(files.map((f) => fromFile(f, f.webkitRelativePath || f.name)), fallbackName);
}

export async function libraryFromZip(file: File): Promise<Library> {
  return buildLibrary(readZip(await file.arrayBuffer()), file.name.replace(/\.zip$/i, ''));
}

const MAX_DEPTH = 12;

async function walk(dir: FileSystemDirectoryHandle, prefix: string, out: RawFile[], depth: number): Promise<void> {
  if (depth > MAX_DEPTH) return;
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.') || name === 'node_modules') continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      await walk(handle, path, out, depth + 1);
    } else if (extOf(name) in LANGUAGES) {
      // Only supported source files are opened; everything else is never read.
      const file = await handle.getFile();
      out.push(fromFile(file, path));
    } else {
      out.push({ path, size: MAX_FILE_BYTES, read: async () => '' });
    }
  }
}

/** Reads a folder granted through the File System Access API (read-only). */
export async function libraryFromDirectory(dir: FileSystemDirectoryHandle): Promise<Library> {
  const raw: RawFile[] = [];
  await walk(dir, '', raw, 0);
  return buildLibrary(raw, dir.name);
}

/** Opens the native folder picker; resolves to null when the user cancels. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await window.showDirectoryPicker({ mode: 'read' });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    throw e;
  }
}

/** Asks again for read permission on a remembered folder (needs a user gesture). */
export async function ensureReadPermission(dir: FileSystemDirectoryHandle): Promise<boolean> {
  const opts = { mode: 'read' } as const;
  if ((await dir.queryPermission(opts)) === 'granted') return true;
  return (await dir.requestPermission(opts)) === 'granted';
}
