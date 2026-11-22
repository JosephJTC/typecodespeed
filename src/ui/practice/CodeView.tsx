import { memo, useLayoutEffect, useRef } from 'react';
import { buildDisplay, type DisplayCode, type Evaluator } from '../../engine';

const CLASS: Record<DisplayCode, string> = {
  c: 'ch-correct',
  i: 'ch-incorrect',
  m: 'ch-missed',
  f: 'ch-typed-space',
  x: 'ch-extra',
  p: 'ch-pending',
};

interface Props {
  evaluator: Evaluator;
  /** Changes on every keystroke; used to re-render. */
  version: number;
  focused: boolean;
}

/** Draws what the user typed followed by the pending code, which flows after it. */
export function CodeView({ evaluator, version, focused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { text, codes, caret } = buildDisplay(evaluator);

  const lines: Array<{ start: number; end: number }> = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ start, end: i });
      start = i + 1;
    }
  }
  const caretLine = lines.findIndex((l) => caret >= l.start && caret <= l.end);

  useLayoutEffect(() => {
    const el = containerRef.current?.querySelector('.caret');
    if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [version, caretLine]);

  return (
    <div className={focused ? 'code-view focused' : 'code-view'} ref={containerRef} data-testid="code-view">
      {lines.map((l, n) => (
        <Line key={n} number={n + 1} text={text.slice(l.start, l.end)} codes={codes.slice(l.start, l.end)} caretCol={n === caretLine ? caret - l.start : -1} />
      ))}
    </div>
  );
}

const Line = memo(function Line({ number, text, codes, caretCol }: { number: number; text: string; codes: string; caretCol: number }) {
  const out: React.ReactNode[] = [];
  let runStart = 0;
  for (let col = 0; col <= text.length; col++) {
    if (col > runStart && (col === text.length || col === caretCol || codes[col] !== codes[runStart])) {
      out.push(<span key={runStart} className={CLASS[codes[runStart] as DisplayCode]}>{text.slice(runStart, col)}</span>);
      runStart = col;
    }
    if (col === caretCol) out.push(<span key="caret" className="caret" />);
  }
  return (
    <div className={caretCol >= 0 ? 'code-line current' : 'code-line'}>
      <span className="line-no">{number}</span>
      <span className="line-text">{out.length ? out : '\u200b'}</span>
    </div>
  );
});
