import { TypingSession, type SessionConfig } from '../../session';
import { buildRecord } from '../compute';
import type { TestMeta, TestRecord } from '../types';

export class FakeClock {
  t = 1000;
  now = () => this.t;
  advance(ms: number) {
    this.t += ms;
  }
}

export const META: TestMeta = {
  testType: 'full',
  sourceName: 'Prueba',
  sourceId: 'test',
  language: 'cpp',
  mode: 'tolerant',
  comments: 'omit',
  errorPolicy: 'advance',
};

export function makeSession(text: string, overrides: Partial<SessionConfig> = {}, clock = new FakeClock()) {
  const s = new TypingSession(text, {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: 'advance',
    autoIndent: true,
    idleTimeoutMs: 0,
    now: clock.now,
    ...overrides,
  });
  return { s, clock };
}

/** Script: plain characters are typed, `<` is a backspace; `ms` passes before each key. */
export function play(s: TypingSession, clock: FakeClock, script: string, ms = 200) {
  for (const ch of script) {
    clock.advance(ms);
    if (ch === '<') s.backspace();
    else s.input(ch);
  }
}

export function recordOf(s: TypingSession, meta: Partial<TestMeta> = {}, extra: Partial<{ id: string; finishedAt: number }> = {}): TestRecord {
  if (s.status !== 'finished') s.abort();
  return buildRecord({
    log: s.log,
    snapshot: s.snapshot(),
    meta: { ...META, ...meta },
    texts: s.texts,
    finishedAt: extra.finishedAt ?? 1_700_000_000_000,
    id: extra.id ?? 'r1',
  });
}

/** A finished test produced by actually typing `script` over `text`. */
export function quickRecord(text: string, script: string, opts: { ms?: number; id?: string; finishedAt?: number; meta?: Partial<TestMeta>; config?: Partial<SessionConfig> } = {}): TestRecord {
  const { s, clock } = makeSession(text, opts.config);
  play(s, clock, script, opts.ms);
  return recordOf(s, opts.meta, { id: opts.id, finishedAt: opts.finishedAt });
}
