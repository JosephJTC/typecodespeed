import { t, tp } from '../../i18n';
import { averageMetrics, comparableTo, compareRecords, COMPARED_METRICS, timeline, type ComparedMetric, type TestRecord } from '../../stats';
import { LineChart } from '../charts/LineChart';
import { fmt, formatTime, percent } from '../practice/format';
import { Breakdown } from './Breakdown';
import { formatDelta, formatMetric } from './labels';

const COLORS = { main: '#58a6ff', alt: '#8b93a7', good: '#3fb950', warn: '#d29922' };

export function MetricCards({ record: r }: { record: TestRecord }) {
  const cards: Array<[string, string, string?]> = [
    [t('stats.metrics.wpm'), fmt(r.wpm, 1), t('stats.help.wpm')],
    [t('stats.metrics.cps'), fmt(r.cps, 2)],
    [t('stats.metrics.accuracy'), percent(r.accuracy), t('stats.help.accuracy')],
    [t('stats.metrics.completion'), percent(r.completion), t('stats.help.completion')],
    [t('stats.metrics.durationMs'), formatTime(r.durationMs)],
    [t('stats.metrics.rawWpm'), fmt(r.rawWpm, 1), t('stats.help.rawWpm')],
    [t('stats.metrics.consistency'), percent(r.consistency), t('stats.help.consistency')],
    [t('stats.metrics.errorsMade'), fmt(r.errorsMade)],
    [t('stats.metrics.uncorrected'), fmt(r.uncorrected)],
    [t('stats.metrics.corrections'), fmt(r.corrections)],
    [t('stats.metrics.correctChars'), fmt(r.correctChars)],
    [t('stats.metrics.keystrokes'), fmt(r.keystrokes)],
    [t('stats.metrics.tokens'), t('practice.of', { value: r.tokensCorrect, total: r.tokensTotal })],
  ];
  if (r.testType === 'timed') cards.push([t('stats.metrics.texts'), fmt(r.textsCompleted)]);
  return (
    <dl className="stats metric-cards">
      {cards.map(([label, value, help]) => (
        <div className="stat" key={label} title={help}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TimelineCharts({ record }: { record: TestRecord }) {
  const points = timeline(record);
  const common = { xLabel: t('stats.charts.seconds'), emptyText: t('stats.charts.noData'), formatX: (x: number) => fmt(x, x % 1 ? 1 : 0) };
  return (
    <div className="chart-grid">
      <LineChart
        {...common}
        title={t('stats.charts.cps')}
        yLabel={t('stats.charts.cpsAxis')}
        yMin={0}
        formatY={(y) => fmt(y, 1)}
        series={[{ label: t('stats.charts.cpsAxis'), color: COLORS.main, points: points.map((p) => ({ x: p.t, y: p.cps })) }]}
      />
      <LineChart
        {...common}
        title={t('stats.charts.speed')}
        yLabel={t('stats.charts.wpmAxis')}
        yMin={0}
        formatY={(y) => fmt(y)}
        series={[
          { label: t('stats.charts.net'), color: COLORS.main, points: points.map((p) => ({ x: p.t, y: p.wpm })) },
          { label: t('stats.charts.raw'), color: COLORS.alt, points: points.map((p) => ({ x: p.t, y: p.rawWpm })) },
          { label: t('stats.charts.average'), color: COLORS.good, dashed: true, points: points.map((p) => ({ x: p.t, y: p.cumulativeWpm })) },
        ]}
      />
      <LineChart
        {...common}
        title={t('stats.charts.accuracy')}
        yLabel={t('stats.charts.accuracyAxis')}
        yMin={0}
        yMax={1}
        formatY={(y) => `${fmt(y * 100)} %`}
        series={[
          { label: t('stats.charts.interval'), color: COLORS.main, points: points.map((p) => ({ x: p.t, y: p.accuracy })) },
          { label: t('stats.charts.cumulative'), color: COLORS.good, dashed: true, points: points.map((p) => ({ x: p.t, y: p.cumulativeAccuracy })) },
        ]}
      />
    </div>
  );
}

/** Table of metric differences between a baseline and a test. */
export function ComparisonTable(props: { a: Pick<TestRecord, ComparedMetric>; b: Pick<TestRecord, ComparedMetric>; aLabel: string; bLabel: string }) {
  const cmp = compareRecords(props.a, props.b);
  return (
    <table className="compare-table">
      <thead>
        <tr>
          <th>{t('stats.comparison.metric')}</th>
          <th>{props.aLabel}</th>
          <th>{props.bLabel}</th>
          <th>{t('stats.comparison.difference')}</th>
        </tr>
      </thead>
      <tbody>
        {COMPARED_METRICS.map((m) => {
          const c = cmp[m];
          const cls = c.better === null ? '' : c.better ? 'ok' : 'bad';
          const verdict = c.delta === 0 ? t('stats.comparison.same') : c.better === null ? '' : t(c.better ? 'stats.comparison.better' : 'stats.comparison.worse');
          return (
            <tr key={m} data-metric={m}>
              <th scope="row">{t(`stats.metrics.${m}`)}</th>
              <td>{formatMetric(m, c.a)}</td>
              <td>{formatMetric(m, c.b)}</td>
              <td className={cls}>
                {formatDelta(m, c.delta)} {verdict && <small>({verdict})</small>}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Compares a test with the user's earlier tests of the same kind. */
export function AgainstHistory({ record, history }: { record: TestRecord; history: readonly TestRecord[] }) {
  const earlier = comparableTo(record, history);
  const avg = averageMetrics(earlier);
  if (!avg) return <p className="hint">{t('stats.comparison.first')}</p>;
  const best = Math.max(...earlier.map((r) => r.wpm));
  return (
    <>
      <p className="hint">{tp('stats.comparison.vsAverage', earlier.length)}</p>
      <ComparisonTable a={avg} b={record} aLabel={t('stats.comparison.average')} bLabel={t('stats.comparison.thisTest')} />
      <p className={record.wpm > best ? 'ok' : 'hint'}>{record.wpm > best ? t('stats.comparison.newBest') : t('stats.comparison.vsBest', { wpm: fmt(best, 1) })}</p>
    </>
  );
}

/** Full analysis of one test: metrics, timeline charts, breakdowns and comparison with history. */
export function RecordDetail({ record, history }: { record: TestRecord; history: readonly TestRecord[] }) {
  return (
    <div className="record-detail">
      <MetricCards record={record} />
      <TimelineCharts record={record} />
      <Breakdown data={record} />
      <h3>{t('stats.comparison.title')}</h3>
      <AgainstHistory record={record} history={history} />
    </div>
  );
}
