/** One character of an exercise, as the user typed it. */
export interface CharResult {
  ch: string;
  /** Wrong keys pressed before the right one. */
  errors: number;
  /** Time from the previous correct key to this one, in milliseconds. */
  ms: number;
}

export interface ExerciseSummary {
  chars: number;
  errors: number;
  /** Correct presses over all presses (0–1). */
  accuracy: number;
  wpm: number;
  ms: number;
  completed: boolean;
}

/**
 * State of a tutor exercise. A wrong key does not advance: the user must find
 * the right one, which is what builds the finger-to-key association.
 */
export class Exercise {
  readonly text: string;
  readonly results: CharResult[] = [];
  private pendingErrors = 0;
  private startedAt: number | null = null;
  private lastAt = 0;
  private endedAt: number | null = null;
  /** Last wrong character, until the next correct press. */
  lastWrong: string | null = null;
  private readonly limitMs?: number;

  constructor(text: string, limitMs?: number) {
    this.text = text;
    this.limitMs = limitMs;
  }

  get pos(): number {
    return this.results.length;
  }

  get target(): string | undefined {
    return this.finished ? undefined : this.text[this.pos];
  }

  get finished(): boolean {
    return this.endedAt !== null;
  }

  get started(): boolean {
    return this.startedAt !== null;
  }

  /** Applies a typed character; returns whether it was the expected one. */
  press(ch: string, now: number): boolean {
    if (this.finished) return false;
    if (this.startedAt === null) this.startedAt = this.lastAt = now;
    if (this.tick(now)) return false;
    if (ch !== this.text[this.pos]) {
      this.pendingErrors++;
      this.lastWrong = ch;
      return false;
    }
    this.results.push({ ch, errors: this.pendingErrors, ms: now - this.lastAt });
    this.pendingErrors = 0;
    this.lastWrong = null;
    this.lastAt = now;
    if (this.pos === this.text.length) this.endedAt = now;
    return true;
  }

  /** Ends a timed exercise when its time is over; returns whether it ended. */
  tick(now: number): boolean {
    if (this.finished) return true;
    if (this.limitMs === undefined || this.startedAt === null || now - this.startedAt < this.limitMs) return false;
    this.endedAt = this.startedAt + this.limitMs;
    return true;
  }

  /** Ends the exercise before its text or time is over. */
  stop(now: number): void {
    if (!this.finished) this.endedAt = this.startedAt === null ? now : Math.max(now, this.startedAt);
  }

  elapsed(now: number): number {
    if (this.startedAt === null) return 0;
    return (this.endedAt ?? now) - this.startedAt;
  }

  remaining(now: number): number | undefined {
    return this.limitMs === undefined ? undefined : Math.max(0, this.limitMs - this.elapsed(now));
  }

  summary(now: number): ExerciseSummary {
    const chars = this.results.length;
    const errors = this.results.reduce((a, r) => a + r.errors, 0) + this.pendingErrors;
    const ms = this.elapsed(now);
    return {
      chars,
      errors,
      accuracy: chars + errors > 0 ? chars / (chars + errors) : 1,
      wpm: ms > 0 ? chars / 5 / (ms / 60000) : 0,
      ms,
      completed: this.limitMs !== undefined ? this.finished && chars > 0 : chars === this.text.length,
    };
  }
}
