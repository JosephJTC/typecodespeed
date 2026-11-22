import { t } from '../../i18n';
import { timeline, type TestRecord } from '../../stats';
import { LineChart } from '../charts/LineChart';
import { fmt } from '../practice/format';
import { formatDate } from './labels';
import { ComparisonTable } from './RecordDetail';

/** Side-by-side comparison of two stored tests (A = older). */
export function CompareView({ records, onClose }: { records: [TestRecord, TestRecord]; onClose: () => void }) {
  const [a, b] = [...records].sort((x, y) => x.finishedAt - y.finishedAt);
  const label = (name: string, r: TestRecord) => `${name} · ${formatDate(r.finishedAt)} · ${r.sourceName}`;
  const la = label(t('stats.comparison.testA'), a);
  const lb = label(t('stats.comparison.testB'), b);
  const ta = timeline(a);
  const tb = timeline(b);
  const common = { xLabel: t('stats.charts.seconds'), emptyText: t('stats.charts.noData'), formatX: (x: number) => fmt(x, x % 1 ? 1 : 0) };
  return (
    <section className="compare" data-testid="compare">
      <h3>{t('stats.comparison.title')}</h3>
      <ComparisonTable a={a} b={b} aLabel={la} bLabel={lb} />
      <div className="chart-grid">
        <LineChart
          {...common}
          title={t('stats.charts.compareSpeed')}
          yLabel={t('stats.charts.wpmAxis')}
          yMin={0}
          formatY={(y) => fmt(y)}
          series={[
            { label: la, color: '#8b93a7', points: ta.map((p) => ({ x: p.t, y: p.wpm })) },
            { label: lb, color: '#58a6ff', points: tb.map((p) => ({ x: p.t, y: p.wpm })) },
          ]}
        />
        <LineChart
          {...common}
          title={t('stats.charts.compareAccuracy')}
          yLabel={t('stats.charts.accuracyAxis')}
          yMin={0}
          yMax={1}
          formatY={(y) => `${fmt(y * 100)} %`}
          series={[
            { label: la, color: '#8b93a7', points: ta.map((p) => ({ x: p.t, y: p.cumulativeAccuracy })) },
            { label: lb, color: '#58a6ff', points: tb.map((p) => ({ x: p.t, y: p.cumulativeAccuracy })) },
          ]}
        />
      </div>
      <div className="actions">
        <button onClick={onClose}>{t('stats.comparison.close')}</button>
      </div>
    </section>
  );
}
