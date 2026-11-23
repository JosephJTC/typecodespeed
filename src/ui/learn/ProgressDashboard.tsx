import { t } from '../../i18n';
import { FINGERS, fingerStats, hardestChars, totals, type Progress } from '../../learn';
import { BarList } from '../charts/BarList';
import { LineChart } from '../charts/LineChart';
import { fmt, formatTime, percent } from '../practice/format';
import { KeyboardView } from './KeyboardView';
import type { Keyboard } from './useKeyboard';

interface Props {
  progress: Progress;
  keyboard: Keyboard;
  onReset: () => void;
}

/** Compact overview of what the user has learned and which keys and fingers need work. */
export function ProgressDashboard({ progress, keyboard, onReset }: Props) {
  const sum = totals(progress);
  if (sum.exercises === 0) return <p className="hint">{t('learn.progress.empty')}</p>;

  const passed = keyboard.lessons.filter((l) => progress.lessons[l.id]?.passed).length;
  const heat = new Map(Object.entries(progress.keys).filter(([, s]) => s.attempts >= 3).map(([code, s]) => [code, s.errors / s.attempts]));
  const fingers = fingerStats(progress, keyboard.fingers).sort((a, b) => FINGERS.indexOf(a.finger) - FINGERS.indexOf(b.finger));
  const hardest = hardestChars(progress);
  const x = { xLabel: t('learn.progress.exerciseNumber'), emptyText: t('stats.charts.noData'), integerX: true, formatX: (n: number) => fmt(n) };

  return (
    <section className="learn-progress">
      <dl className="stats metric-cards overview" data-testid="learn-overview">
        <div className="stat"><dt>{t('learn.progress.lessons')}</dt><dd>{t('learn.progress.lessonsValue', { done: passed, total: keyboard.lessons.length })}</dd></div>
        <div className="stat"><dt>{t('learn.progress.exercises')}</dt><dd>{fmt(sum.exercises)}</dd></div>
        <div className="stat"><dt>{t('learn.progress.time')}</dt><dd>{formatTime(sum.ms)}</dd></div>
        <div className="stat"><dt>{t('learn.progress.wpm')}</dt><dd>{fmt(sum.wpm, 1)}</dd></div>
        <div className="stat"><dt>{t('learn.progress.accuracy')}</dt><dd>{percent(sum.accuracy)}</dd></div>
      </dl>

      <h3>{t('learn.progress.heatmap')} <small>{t('learn.progress.heatmapHelp')}</small></h3>
      <div className="guide">
        <KeyboardView board={keyboard.board} layout={keyboard.layout} fingers={keyboard.fingers} highlight="none" heat={heat} />
      </div>

      <div className="chart-grid">
        <BarList
          title={t('learn.progress.fingers')}
          emptyText={t('stats.charts.noData')}
          color="var(--accent)"
          max={1}
          bars={fingers.map((f) => ({ key: f.finger, label: t(`learn.fingers.${f.finger}`), value: f.accuracy, text: t('learn.progress.accuracyText', { accuracy: percent(f.accuracy), attempts: f.attempts }) }))}
        />
        <BarList
          title={t('learn.progress.hardest')}
          emptyText={t('learn.progress.noErrors')}
          max={1}
          bars={hardest.map((c) => ({ key: c.ch, label: c.ch, code: true, value: c.rate, text: t('learn.progress.rateText', { rate: percent(c.rate), errors: c.errors, attempts: c.attempts }) }))}
        />
      </div>
      <p className="hint small">{t('learn.progress.fingersHelp')} {t('learn.honesty')}</p>

      <h3>{t('learn.progress.evolution')}</h3>
      <div className="chart-grid">
        <LineChart {...x} title={t('learn.progress.wpmChart')} yLabel={t('stats.charts.wpmAxis')} yMin={0} formatY={(y) => fmt(y)} series={[{ label: t('stats.charts.wpmAxis'), color: '#58a6ff', dots: true, points: progress.runs.map((r, i) => ({ x: i + 1, y: r.wpm })) }]} />
        <LineChart {...x} title={t('learn.progress.accuracyChart')} yLabel={t('stats.charts.accuracyAxis')} yMin={0} yMax={1} formatY={(y) => `${fmt(y * 100)} %`} series={[{ label: t('stats.charts.accuracyAxis'), color: '#3fb950', dots: true, points: progress.runs.map((r, i) => ({ x: i + 1, y: r.accuracy })) }]} />
      </div>

      <div className="actions">
        <button className="danger" onClick={() => window.confirm(t('learn.progress.confirmReset')) && onReset()}>{t('learn.progress.reset')}</button>
      </div>
    </section>
  );
}
