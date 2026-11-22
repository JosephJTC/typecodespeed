import { es } from './locales/es';

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
/** Estructura que debe cumplir cualquier idioma (todas las claves de `es`). */
export type Messages = Widen<typeof es>;

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Leaves<Messages>;

export type Locale = 'es';
const catalogs: Record<Locale, Messages> = { es };
const intlLocales: Record<Locale, string> = { es: 'es-419' };

let current: Locale = 'es';

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

/** Traduce una clave e interpola parámetros `{nombre}`. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  let node: unknown = catalogs[current];
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  let text = typeof node === 'string' ? node : key;
  if (params) text = text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? formatNumber(params[name]) : m));
  return text;
}

type PluralKey<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends { one: string; other: string }
    ? `${P}${K}`
    : T[K] extends string
      ? never
      : PluralKey<T[K], `${P}${K}.`>;
}[keyof T & string];
export type PluralMessageKey = PluralKey<Messages>;

/** Traduce una clave con formas `one`/`other` según `count` (disponible como `{count}`). */
export function tp(key: PluralMessageKey, count: number, params?: Record<string, string | number>): string {
  const form = new Intl.PluralRules(intlLocales[current]).select(count) === 'one' ? 'one' : 'other';
  return t(`${key}.${form}` as MessageKey, { ...params, count });
}

function formatNumber(value: string | number): string {
  return typeof value === 'number' ? new Intl.NumberFormat(intlLocales[current]).format(value) : value;
}
