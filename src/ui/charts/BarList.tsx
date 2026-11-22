export interface Bar {
  key: string;
  label: string;
  /** Mono-spaced label (characters, code). */
  code?: boolean;
  value: number;
  /** Text shown at the right, e.g. "25 % (5 de 20)". */
  text: string;
}

interface Props {
  title: string;
  bars: Bar[];
  /** Value that fills the whole bar; defaults to the largest value. */
  max?: number;
  emptyText: string;
  color?: string;
}

/** Horizontal bar chart as an accessible list. */
export function BarList({ title, bars, max, emptyText, color = '#ff7b72' }: Props) {
  const top = max ?? Math.max(0, ...bars.map((b) => b.value));
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      {bars.length === 0 ? (
        <p className="hint">{emptyText}</p>
      ) : (
        <ul className="bar-list">
          {bars.map((b) => (
            <li key={b.key}>
              <span className={b.code ? 'bar-label code' : 'bar-label'}>{b.label}</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${top > 0 ? Math.min(100, (b.value / top) * 100) : 0}%`, background: color }} />
              </span>
              <span className="bar-text">{b.text}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
