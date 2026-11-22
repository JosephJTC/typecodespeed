/** A source file of the user's local reference collection. It only ever lives in the browser. */
export interface RefFile {
  /** Path relative to the selected folder, with `/` separators. Unique within the library. */
  path: string;
  name: string;
  /** Folder that contains the file (`''` for the root). */
  dir: string;
  ext: string;
  /** Language id used by the comparison engine (`cpp` or `plaintext`). */
  language: string;
  /** Human-readable language name, e.g. `C++`, `Python`. */
  languageName: string;
  text: string;
  lines: number;
  chars: number;
}

export interface Library {
  /** Name of the selected folder or ZIP file. */
  name: string;
  importedAt: number;
  files: RefFile[];
  /** Files that were left out and why. */
  skipped: { tooLarge: number; unsupported: number; binary: number; empty: number };
}

export interface TreeNode {
  name: string;
  /** Path of the folder (`''` for the root). */
  path: string;
  folders: TreeNode[];
  files: RefFile[];
  /** Files in this folder and all its subfolders. */
  total: number;
}

/** Raw file before filtering: a path and a way to read its text. */
export interface RawFile {
  path: string;
  size: number;
  read: () => Promise<string>;
}
