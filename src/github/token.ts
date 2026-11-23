/** Fine-grained (`github_pat_…`) or classic (`ghp_…`, …) personal access token. */
/** Only characters that are safe in an HTTP header; GitHub App tokens may be long and contain `.` and `-`. */
const TOKEN_RE = /^(github_pat_[A-Za-z0-9_]{20,255}|gh[pousr]_[A-Za-z0-9_.-]{20,1024})$/;

export const isValidToken = (token: string) => TOKEN_RE.test(token);
export const isFineGrained = (token: string) => token.startsWith('github_pat_');

export const MIN_PASSPHRASE = 8;
const ITERATIONS = 310_000;
const STORAGE_KEY = 'typecodespeed.github.token';

/** Token encrypted with a key derived from the user's passphrase (PBKDF2-SHA256 + AES-GCM). */
export interface SealedToken {
  v: 1;
  salt: string;
  iv: string;
  data: string;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealToken(token: string, passphrase: string): Promise<SealedToken> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token)));
  return { v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

/** Returns the token, or null when the passphrase is wrong or the data was altered. */
export async function openToken(sealed: SealedToken, passphrase: string): Promise<string | null> {
  try {
    const key = await deriveKey(passphrase, unb64(sealed.salt));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) as BufferSource }, key, unb64(sealed.data) as BufferSource);
    const token = new TextDecoder().decode(plain);
    return isValidToken(token) ? token : null;
  } catch {
    return null;
  }
}

export function loadSealedToken(storage: Pick<Storage, 'getItem'> = localStorage): SealedToken | null {
  try {
    const v: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    if (!v || typeof v !== 'object') return null;
    const s = v as Record<string, unknown>;
    return s.v === 1 && typeof s.salt === 'string' && typeof s.iv === 'string' && typeof s.data === 'string' ? (s as unknown as SealedToken) : null;
  } catch {
    return null;
  }
}

export function saveSealedToken(sealed: SealedToken, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(sealed));
}

export function forgetSealedToken(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing was saved.
  }
}
