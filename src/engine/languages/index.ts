import type { LanguageProfile } from '../types';
import { cpp } from './cpp';
import { plaintext } from './plaintext';

const registry = new Map<string, LanguageProfile>();

export function registerLanguage(profile: LanguageProfile): void {
  registry.set(profile.id, profile);
}

registerLanguage(cpp);
registerLanguage(plaintext);

export function getLanguage(id: string): LanguageProfile {
  return registry.get(id) ?? plaintext;
}

export function languageForFile(fileName: string): LanguageProfile {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  for (const profile of registry.values()) {
    if (profile.extensions.includes(ext)) return profile;
  }
  return plaintext;
}

export function listLanguages(): LanguageProfile[] {
  return [...registry.values()];
}

export { cpp, plaintext };
