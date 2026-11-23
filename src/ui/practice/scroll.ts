/**
 * Scroll needed so that `[start, end)` stays inside `[viewStart, viewEnd)`
 * with at least `margin` pixels to spare on each side (negative scrolls back).
 */
export function scrollDelta(viewStart: number, viewEnd: number, start: number, end: number, margin: number): number {
  const m = Math.max(0, Math.min(margin, (viewEnd - viewStart - (end - start)) / 2));
  if (end > viewEnd - m) return end - (viewEnd - m);
  if (start < viewStart + m) return start - (viewStart + m);
  return 0;
}
