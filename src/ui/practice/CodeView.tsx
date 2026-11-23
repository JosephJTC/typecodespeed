import { memo, useLayoutEffect, useRef } from 'react';
import type { Display, DisplayCode } from '../../engine';
import { scrollDelta } from './scroll';

const CLASS: Record<DisplayCode, string> = {
  c: 'ch-correct',
  i: 'ch-incorrect',
  m: 'ch-missed',
  f: 'ch-typed-space',
  x: 'ch-extra',
  p: 'ch-pending',
  a: 'ch-auto',
};

interface Props {
  display: Display;
  /** Changes on every keystroke; used to re-render. */
  version: number;
  focused: boolean;
}

/** Draws what the user typed followed by the pending code, which flows after it. */
export function CodeView({ display, version, focused }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { text, codes, caret, selStart, selEnd } = display;

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
    const view = containerRef.current;
    const el = view?.querySelector<HTMLElement>('.caret');
    if (view && el) followCaret(view, el);
  }, [version, caretLine]);

  return (
    <div className={focused ? 'code-view focused' : 'code-view'} ref={containerRef} data-testid="code-view">
      {lines.map((l, n) => (
        <Line
          key={n}
          number={n + 1}
          text={text.slice(l.start, l.end)}
          codes={codes.slice(l.start, l.end)}
          caretCol={n === caretLine ? caret - l.start : -1}
          selFrom={Math.max(0, selStart - l.start)}
          selTo={Math.max(0, Math.min(l.end + 1, selEnd) - l.start)}
        />
      ))}
    </div>
  );
}

/** Keeps the caret in view with several lines of the code that follows (or precedes) it visible. */
function followCaret(view: HTMLElement, caret: HTMLElement) {
  const v = view.getBoundingClientRect();
  const c = caret.getBoundingClientRect();
  view.scrollTop += scrollDelta(v.top, v.bottom, c.top, c.bottom, v.height / 3);
  view.scrollLeft += scrollDelta(v.left, v.right, c.left, c.right, 48);
  const page = scrollDelta(0, window.innerHeight, v.top, v.bottom, 0);
  if (page && caret.scrollIntoView) caret.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

interface LineProps {
  number: number;
  text: string;
  codes: string;
  caretCol: number;
  /** Selected columns `[selFrom, selTo)`; `selTo` past the text marks the line break as selected. */
  selFrom: number;
  selTo: number;
}

const Line = memo(function Line({ number, text, codes, caretCol, selFrom, selTo }: LineProps) {
  const out: React.ReactNode[] = [];
  const selected = (col: number) => col >= selFrom && col < selTo;
  let runStart = 0;
  for (let col = 0; col <= text.length; col++) {
    if (col > runStart && (col === text.length || col === caretCol || codes[col] !== codes[runStart] || selected(col) !== selected(runStart))) {
      const cls = CLASS[codes[runStart] as DisplayCode] + (selected(runStart) ? ' sel' : '');
      out.push(<span key={runStart} className={cls}>{text.slice(runStart, col)}</span>);
      runStart = col;
    }
    if (col === caretCol) out.push(<span key="caret" className="caret" />);
  }
  if (selTo > text.length && selFrom <= text.length) out.push(<span key="eol" className="sel eol"> </span>);
  return (
    <div className={caretCol >= 0 ? 'code-line current' : 'code-line'}>
      <span className="line-no">{number}</span>
      <span className="line-text">{out.length ? out : '\u200b'}</span>
    </div>
  );
});
