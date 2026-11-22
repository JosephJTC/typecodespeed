/** "Nice" axis ticks (multiples of 1, 2, 2.5 or 5 × 10ⁿ) covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min > max) [min, max] = [max, min];
  if (min === max) {
    if (min === 0) return [0, 1];
    const pad = Math.abs(min) * 0.1;
    min -= pad;
    max += pad;
  }
  const rough = (max - min) / Math.max(1, target);
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough)!;
  const first = Math.floor(min / step + 1e-9) * step;
  const ticks: number[] = [];
  for (let v = first; v < max + step - 1e-9 * step; v += step) ticks.push(Number(v.toPrecision(12)));
  return ticks;
}

export interface Point {
  x: number;
  /** null leaves a gap in the line. */
  y: number | null;
}

/** SVG path for a line with gaps where `y` is null. */
export function linePath(points: readonly Point[], sx: (x: number) => number, sy: (y: number) => number): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (p.y === null) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`;
    pen = true;
  }
  return d;
}
