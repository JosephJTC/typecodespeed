import type { CharResult, ExerciseSummary } from './exercise';
import type { Finger } from './fingers';
import type { CharStat } from './generator';
import type { Stroke } from './layouts';

/** Accuracy needed to count a lesson as completed. */
export const PASS_ACCURACY = 0.9;
const MAX_RUNS = 300;

export interface LessonProgress {
  runs: number;
  bestAccuracy: number;
  bestWpm: number;
  passed: boolean;
}

export interface Run {
  at: number;
  lesson: string;
  wpm: number;
  accuracy: number;
  ms: number;
  chars: number;
}

/** Everything remembered about the user's learning; stored only in this browser. */
export interface Progress {
  /** Statistics by character typed. */
  chars: Record<string, CharStat>;
  /** Statistics by physical key (`KeyboardEvent.code`), for the heat map and the fingers. */
  keys: Record<string, CharStat>;
  lessons: Record<string, LessonProgress>;
  runs: Run[];
}

export const emptyProgress = (): Progress => ({ chars: {}, keys: {}, lessons: {}, runs: [] });

const bump = (into: Record<string, CharStat>, key: string, r: CharResult) => {
  const s = into[key] ?? { attempts: 0, errors: 0, ms: 0 };
  // One attempt per wrong key plus the correct one; only the correct press is timed.
  into[key] = { attempts: s.attempts + r.errors + 1, errors: s.errors + r.errors, ms: s.ms + Math.min(r.ms, 5000) };
};

/** Adds a finished exercise to the progress. */
export function recordRun(p: Progress, lesson: string, results: readonly CharResult[], summary: ExerciseSummary, map: ReadonlyMap<string, Stroke[]>, at: number): Progress {
  const chars = { ...p.chars };
  const keys = { ...p.keys };
  // The first character has no reaction time: the clock starts with it.
  results.forEach((r, i) => {
    const timed = i === 0 ? { ...r, ms: 0 } : r;
    bump(chars, r.ch, timed);
    const code = map.get(r.ch)?.at(-1)?.code;
    if (code) bump(keys, code, timed);
  });
  const prev = p.lessons[lesson] ?? { runs: 0, bestAccuracy: 0, bestWpm: 0, passed: false };
  const passed = summary.completed && summary.accuracy >= PASS_ACCURACY;
  return {
    chars,
    keys,
    lessons: {
      ...p.lessons,
      [lesson]: {
        runs: prev.runs + 1,
        bestAccuracy: Math.max(prev.bestAccuracy, summary.completed ? summary.accuracy : 0),
        bestWpm: Math.max(prev.bestWpm, passed ? summary.wpm : 0),
        passed: prev.passed || passed,
      },
    },
    runs: [...p.runs, { at, lesson, wpm: summary.wpm, accuracy: summary.accuracy, ms: summary.ms, chars: summary.chars }].slice(-MAX_RUNS),
  };
}

export interface FingerStat extends CharStat {
  finger: Finger;
  accuracy: number;
}

/** Accuracy by recommended finger: the keys assigned to it, not the finger actually used (the browser cannot know). */
export function fingerStats(p: Progress, fingers: ReadonlyMap<string, Finger>): FingerStat[] {
  const by = new Map<Finger, CharStat>();
  for (const [code, s] of Object.entries(p.keys)) {
    const f = fingers.get(code);
    if (!f) continue;
    const cur = by.get(f) ?? { attempts: 0, errors: 0, ms: 0 };
    by.set(f, { attempts: cur.attempts + s.attempts, errors: cur.errors + s.errors, ms: cur.ms + s.ms });
  }
  return [...by.entries()].map(([finger, s]) => ({ finger, ...s, accuracy: s.attempts ? 1 - s.errors / s.attempts : 1 }));
}

/** Characters that fail most, among those tried at least `minAttempts` times. */
export function hardestChars(p: Progress, minAttempts = 5, count = 8): Array<CharStat & { ch: string; rate: number }> {
  return Object.entries(p.chars)
    .filter(([ch, s]) => ch !== ' ' && s.attempts >= minAttempts && s.errors > 0)
    .map(([ch, s]) => ({ ch, ...s, rate: s.errors / s.attempts }))
    .sort((a, b) => b.rate - a.rate || b.errors - a.errors)
    .slice(0, count);
}

export function totals(p: Progress) {
  const ms = p.runs.reduce((a, r) => a + r.ms, 0);
  const chars = p.runs.reduce((a, r) => a + r.chars, 0);
  return {
    exercises: p.runs.length,
    ms,
    wpm: ms > 0 ? chars / 5 / (ms / 60000) : 0,
    accuracy: p.runs.length ? p.runs.reduce((a, r) => a + r.accuracy, 0) / p.runs.length : 0,
    passed: Object.values(p.lessons).filter((l) => l.passed).length,
  };
}

const PROGRESS_KEY = 'typecodespeed.learn';

const isStat = (v: unknown): v is CharStat =>
  !!v && typeof v === 'object' && ['attempts', 'errors', 'ms'].every((k) => Number.isFinite((v as Record<string, unknown>)[k]));

const stats = (v: unknown): Record<string, CharStat> =>
  v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([, s]) => isStat(s))) as Record<string, CharStat> : {};

/** Restores saved progress, dropping anything malformed. */
export function parseProgress(json: string | null): Progress {
  try {
    const raw: unknown = JSON.parse(json ?? 'null');
    if (!raw || typeof raw !== 'object') return emptyProgress();
    const r = raw as Record<string, unknown>;
    const lessons: Record<string, LessonProgress> = {};
    for (const [id, l] of Object.entries((r.lessons as object) ?? {})) {
      const x = l as Partial<LessonProgress>;
      if (Number.isFinite(x?.runs) && Number.isFinite(x?.bestAccuracy) && Number.isFinite(x?.bestWpm)) {
        lessons[id] = { runs: x.runs!, bestAccuracy: x.bestAccuracy!, bestWpm: x.bestWpm!, passed: !!x.passed };
      }
    }
    const runs = (Array.isArray(r.runs) ? r.runs : []).filter(
      (x): x is Run => !!x && typeof x.lesson === 'string' && ['at', 'wpm', 'accuracy', 'ms', 'chars'].every((k) => Number.isFinite(x[k])),
    );
    return { chars: stats(r.chars), keys: stats(r.keys), lessons, runs: runs.slice(-MAX_RUNS) };
  } catch {
    return emptyProgress();
  }
}

export function loadProgress(): Progress {
  try {
    return parseProgress(localStorage.getItem(PROGRESS_KEY));
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable (private mode): progress lasts for this visit only.
  }
}
