import { useId } from 'react';
import { linePath, niceTicks, type Point } from './scale';

export interface Series {
  label: string;
  color: string;
  points: Point[];
  dashed?: boolean;
  /** Draw a dot on every point (useful for few points). */
  dots?: boolean;
}

interface Props {
  title: string;
  series: Series[];
  xLabel: string;
  yLabel: string;
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  /** Fixed lower/upper bound of the Y axis; otherwise derived from the data. */
  yMin?: number;
  yMax?: number;
  /** Only whole numbers on the X axis (e.g. test number). */
  integerX?: boolean;
  emptyText: string;
}

const W = 640;
const H = 240;
const M = { top: 12, right: 16, bottom: 40, left: 52 };

/** Dependency-free SVG line chart; scales with its container. */
export function LineChart({ title, series, xLabel, yLabel, formatX = String, formatY = String, yMin, yMax, integerX, emptyText }: Props) {
  const titleId = useId();
  const all = series.flatMap((s) => s.points);
  const ys = all.map((p) => p.y).filter((y): y is number => y !== null);
  if (ys.length === 0) {
    return (
      <figure className="chart">
        <figcaption>{title}</figcaption>
        <p className="hint">{emptyText}</p>
      </figure>
    );
  }
  const xs = all.map((p) => p.x);
  let x0 = Math.min(...xs);
  let x1 = Math.max(...xs);
  if (x0 === x1) {
    x0 -= 0.5;
    x1 += 0.5;
  }
  const yTicks = niceTicks(yMin ?? Math.min(0, ...ys), yMax ?? Math.max(...ys));
  const y0 = yMin ?? yTicks[0];
  const y1 = yMax ?? yTicks[yTicks.length - 1];
  let xTicks = niceTicks(x0, x1, 6).filter((v) => v >= x0 - 1e-9 && v <= x1 + 1e-9);
  if (integerX) xTicks = [...new Set(xTicks.map(Math.round))].filter((v) => v >= x0 && v <= x1);
  const sx = (x: number) => M.left + ((x - x0) / (x1 - x0)) * (W - M.left - M.right);
  const sy = (y: number) => H - M.bottom - ((Math.min(y1, Math.max(y0, y)) - y0) / (y1 - y0 || 1)) * (H - M.top - M.bottom);

  return (
    <figure className="chart">
      <figcaption id={titleId}>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={titleId} preserveAspectRatio="xMidYMid meet">
        {yTicks.filter((v) => v >= y0 - 1e-9 && v <= y1 + 1e-9).map((v) => (
          <g key={`y${v}`}>
            <line className="grid" x1={M.left} x2={W - M.right} y1={sy(v)} y2={sy(v)} />
            <text className="tick" x={M.left - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle">{formatY(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => (
          <text key={`x${v}`} className="tick" x={sx(v)} y={H - M.bottom + 16} textAnchor="middle">{formatX(v)}</text>
        ))}
        <line className="axis" x1={M.left} x2={W - M.right} y1={H - M.bottom} y2={H - M.bottom} />
        <text className="axis-label" x={(M.left + W - M.right) / 2} y={H - 4} textAnchor="middle">{xLabel}</text>
        <text className="axis-label" transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle">{yLabel}</text>
        {series.map((s) => (
          <g key={s.label} data-series={s.label}>
            <path d={linePath(s.points, sx, sy)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? '5 4' : undefined} strokeLinejoin="round" />
            {(s.dots || s.points.length <= 30) &&
              s.points.map((p, i) =>
                p.y === null ? null : (
                  <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={s.dashed ? 0 : 3} fill={s.color}>
                    <title>{`${s.label} — ${xLabel}: ${formatX(p.x)}, ${formatY(p.y)}`}</title>
                  </circle>
                ),
              )}
          </g>
        ))}
      </svg>
      {series.length > 1 && (
        <ul className="legend">
          {series.map((s) => (
            <li key={s.label}>
              <span className={s.dashed ? 'swatch dashed' : 'swatch'} style={{ borderColor: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
