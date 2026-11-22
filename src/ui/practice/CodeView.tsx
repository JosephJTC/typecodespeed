import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import type { ItemState, Target } from '../../engine';

/**
 * Per-character state codes: c correct, i incorrect, m missed (required whitespace
 * that was skipped), p pending, f free whitespace, g gap with a missing separator.
 */
type Code = 'c' | 'i' | 'm' | 'p' | 'f' | 'g';
const CLASS: Record<Code, string> = { c: 'ch-correct', i: 'ch-incorrect', m: 'ch-missed', p: 'ch-pending', f: 'ch-free', g: 'ch-gap-missed' };

interface Props {
  target: Target;
  states: readonly ItemState[];
  extras: readonly number[];
  caret: number;
  /** Changes on every keystroke; used to re-render. */
  version: number;
  focused: boolean;
}

interface Layout {
  /** For every offset of the text: index of the item drawn there, or -1. */
  itemAt: Int32Array;
  /** Offsets where zero-width gaps live (missing separators are drawn there). */
  zeroGapAt: Map<number, number>;
  /** Item index -> offset where its extra characters are drawn. */
  extraAt: number[];
  lines: Array<{ start: number; end: number }>;
}

function layoutOf(target: Target): Layout {
  const { text, items } = target;
  const itemAt = new Int32Array(text.length).fill(-1);
  const zeroGapAt = new Map<number, number>();
  const extraAt: number[] = [];
  items.forEach((it, i) => {
    extraAt[i] = it.src;
    if (it.kind === 'char') itemAt[it.src] = i;
    else if (it.srcEnd > it.src) for (let o = it.src; o < it.srcEnd; o++) itemAt[o] = i;
    else zeroGapAt.set(it.src, i);
  });
  extraAt[items.length] = text.length;
  const lines: Layout['lines'] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === '\n') {
      lines.push({ start, end: i });
      start = i + 1;
    }
  }
  return { itemAt, zeroGapAt, extraAt, lines };
}

function codeOf(target: Target, idx: number, states: readonly ItemState[]): Code {
  if (idx < 0) return 'f';
  const st = states[idx];
  const item = target.items[idx];
  if (item.kind === 'gap') return st === 'missed' ? 'g' : 'f';
  switch (st) {
    case 'correct':
      return 'c';
    case 'incorrect':
      return 'i';
    case 'missed':
      return 'm';
    default:
      return 'p';
  }
}

export function CodeView({ target, states, extras, caret, version, focused }: Props) {
  const layout = useMemo(() => layoutOf(target), [target]);
  const containerRef = useRef<HTMLDivElement>(null);

  const extraByOffset = new Map<number, number>();
  extras.forEach((n, i) => {
    if (n > 0) extraByOffset.set(layout.extraAt[i], (extraByOffset.get(layout.extraAt[i]) ?? 0) + n);
  });

  const caretLine = layout.lines.findIndex((l) => caret >= l.start && caret <= l.end);

  useLayoutEffect(() => {
    const el = containerRef.current?.querySelector('.caret');
    if (el && 'scrollIntoView' in el) (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [version, caretLine]);

  return (
    <div className={focused ? 'code-view focused' : 'code-view'} ref={containerRef} data-testid="code-view">
      {layout.lines.map((l, n) => {
        let codes = '';
        let marks = '';
        for (let o = l.start; o <= l.end && o <= target.text.length; o++) {
          codes += o < l.end ? codeOf(target, layout.itemAt[o], states) : target.text[o] === '\n' ? codeOf(target, layout.itemAt[o], states) : ' ';
          const gap = layout.zeroGapAt.get(o);
          const extra = extraByOffset.get(o) ?? 0;
          marks += (gap !== undefined && states[gap] === 'missed' ? 'g' : '') + (extra ? `+${extra}` : '') + '|';
        }
        return (
          <Line
            key={n}
            number={n + 1}
            text={target.text.slice(l.start, l.end)}
            codes={codes}
            marks={marks}
            caretCol={n === caretLine ? caret - l.start : -1}
          />
        );
      })}
    </div>
  );
}

const Line = memo(function Line(props: { number: number; text: string; codes: string; marks: string; caretCol: number }) {
  const { text, codes, caretCol } = props;
  const marks = props.marks.split('|');
  const out: React.ReactNode[] = [];
  const pushMarks = (col: number) => {
    const m = marks[col];
    if (!m) return;
    if (m.startsWith('g')) out.push(<span key={`g${col}`} className="mark-missing" title="" />);
    const plus = m.indexOf('+');
    if (plus >= 0) out.push(<span key={`x${col}`} className="mark-extra">{'•'.repeat(Math.min(5, Number(m.slice(plus + 1))))}</span>);
  };
  let run = '';
  let runCode = '';
  let runStart = 0;
  const flush = () => {
    if (run) out.push(<span key={`r${runStart}`} className={CLASS[runCode as Code]}>{run}</span>);
    run = '';
  };
  for (let col = 0; col <= text.length; col++) {
    const hasMark = marks[col] !== '' && marks[col] !== undefined;
    if (col === caretCol || hasMark || col === text.length) flush();
    pushMarks(col);
    if (col === caretCol) out.push(<span key="caret" className="caret" />);
    if (col === text.length) break;
    const code = codes[col];
    if (code !== runCode) flush();
    if (!run) {
      runCode = code;
      runStart = col;
    }
    run += text[col];
  }
  const eol = codes[text.length];
  if (eol === 'm' || eol === 'i') out.push(<span key="eol" className="ch-missed">↵</span>);
  return (
    <div className={caretCol >= 0 ? 'code-line current' : 'code-line'}>
      <span className="line-no">{props.number}</span>
      <span className="line-text">{out.length ? out : '\u200b'}</span>
    </div>
  );
});
