import { useMemo, useRef, useState } from 'react';
import { t, tp } from '../../i18n';
import { bySource, exportHistory, insights, parseHistory, progress, summarize, type TestRecord, type TestType } from '../../stats';
import { LineChart } from '../charts/LineChart';
import { fmt, formatTime, percent } from '../practice/format';
import { Breakdown } from './Breakdown';
import { CompareView } from './CompareView';
import { useHistory } from './history';
import { formatDate, insightText } from './labels';
import { RecordDetail } from './RecordDetail';

const WINDOW = 5;
type Filter = TestType | 'all';

export function StatsPage() {
  const history = useHistory();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const all = history.records;
  const records = useMemo(() => (all ?? []).filter((r) => filter === 'all' || r.testType === filter), [all, filter]);
  const summary = useMemo(() => summarize(records), [records]);
  const points = useMemo(() => progress(records, WINDOW), [records]);
  const notes = useMemo(() => insights(records), [records]);
  const sources = useMemo(() => bySource(records), [records]);

  if (all === null) return <p className="hint">{t('stats.loading')}</p>;

  const detail = detailId ? all.find((r) => r.id === detailId) : undefined;
  if (detail) {
    return (
      <section className="stats-page">
        <div className="actions">
          <button onClick={() => setDetailId(null)}>{t('stats.history.back')}</button>
        </div>
        <h2>{t('stats.history.detailTitle')}</h2>
        <p className="hint">
          {formatDate(detail.finishedAt)} · {t(`practice.types.${detail.testType}`)} · {detail.sourceName} · {t(`modes.${detail.mode}`)}{detail.hideGuide && ` · ${t('practice.noGuideTag')}`} · {t(`stats.finish.${detail.finishReason}`)}
        </p>
        <RecordDetail record={detail} history={all} />
      </section>
    );
  }

  const pair = selected.map((id) => all.find((r) => r.id === id)).filter((r): r is TestRecord => !!r);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-2)));

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportHistory(all)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `typecodespeed-historial-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { tests, skipped } = parseHistory(await file.text());
      await history.addAll(tests);
      setNotice([tp('stats.history.imported', tests.length), skipped ? tp('stats.history.importSkipped', skipped) : ''].filter(Boolean).join(' '));
    } catch {
      setNotice(t('stats.history.importError'));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const xTest = { xLabel: t('stats.charts.testNumber'), emptyText: t('stats.charts.noData'), integerX: true, formatX: (x: number) => fmt(x) };

  return (
    <section className="stats-page">
      <h2>{t('stats.title')}</h2>
      <p className="hint">{t('stats.privacy')}</p>
      {!history.persistent && <p className="bad" role="alert">{t('stats.notPersistent')}</p>}
      {history.failed && <p className="bad" role="alert">{t('stats.storageError')}</p>}
      {notice && <p role="status">{notice}</p>}

      <div className="controls">
        <label>
          {t('stats.history.filter')}
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">{t('stats.history.all')}</option>
            {(['full', 'timed', 'snippet'] as const).map((x) => <option key={x} value={x}>{t(`practice.types.${x}`)}</option>)}
          </select>
        </label>
        <div className="actions">
          <button onClick={download} disabled={all.length === 0}>{t('stats.history.export')}</button>
          <button onClick={() => fileRef.current?.click()}>{t('stats.history.import')}</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden aria-label={t('stats.history.import')} onChange={(e) => void importFile(e.target.files?.[0])} />
        </div>
      </div>

      {records.length === 0 ? (
        <p>{t('stats.empty')}</p>
      ) : (
        <>
          <h3>{t('stats.overview.title')}</h3>
          <dl className="stats metric-cards" data-testid="overview">
            <div className="stat"><dt>{t('stats.overview.tests')}</dt><dd>{fmt(summary.tests)}</dd></div>
            <div className="stat"><dt>{t('stats.overview.totalTime')}</dt><dd>{formatTime(summary.totalTimeMs)}</dd></div>
            <div className="stat"><dt>{t('stats.overview.avgWpm')}</dt><dd>{fmt(summary.avgWpm, 1)}</dd></div>
            <div className="stat"><dt>{t('stats.overview.bestWpm')}</dt><dd>{fmt(summary.bestWpm, 1)}</dd></div>
            <div className="stat"><dt>{t('stats.overview.avgAccuracy')}</dt><dd>{percent(summary.avgAccuracy)}</dd></div>
            <div className="stat"><dt>{t('stats.overview.avgConsistency')}</dt><dd>{percent(summary.avgConsistency)}</dd></div>
          </dl>

          <h3>{t('stats.insightsTitle')}</h3>
          {notes.length === 0 ? <p className="hint">{t('stats.noInsights')}</p> : <ul className="insights">{notes.map((n, i) => <li key={i}>{insightText(n)}</li>)}</ul>}

          <h3>{t('stats.progress')}</h3>
          <div className="chart-grid">
            <LineChart
              {...xTest}
              title={t('stats.charts.progressWpm')}
              yLabel={t('stats.charts.wpmAxis')}
              yMin={0}
              formatY={(y) => fmt(y)}
              series={[
                { label: t('stats.charts.perTest'), color: '#58a6ff', dots: true, points: points.map((p) => ({ x: p.index, y: p.wpm })) },
                { label: t('stats.charts.movingAverage', { count: WINDOW }), color: '#3fb950', dashed: true, points: points.map((p) => ({ x: p.index, y: p.wpmAvg })) },
              ]}
            />
            <LineChart
              {...xTest}
              title={t('stats.charts.progressAccuracy')}
              yLabel={t('stats.charts.accuracyAxis')}
              yMin={Math.min(0.8, Math.floor(Math.min(...points.map((p) => p.accuracy)) * 10) / 10)}
              yMax={1}
              formatY={(y) => `${fmt(y * 100)} %`}
              series={[
                { label: t('stats.charts.perTest'), color: '#58a6ff', dots: true, points: points.map((p) => ({ x: p.index, y: p.accuracy })) },
                { label: t('stats.charts.movingAverage', { count: WINDOW }), color: '#3fb950', dashed: true, points: points.map((p) => ({ x: p.index, y: p.accuracyAvg })) },
              ]}
            />
          </div>

          <h3>{t('stats.weaknesses')}</h3>
          <Breakdown data={summary} minAttempts={5} />

          <h3>{t('stats.bySource.title')}</h3>
          <div className="table-scroll">
            <table data-testid="by-source">
              <thead>
                <tr>
                  <th>{t('stats.bySource.source')}</th>
                  <th>{t('stats.bySource.tests')}</th>
                  <th>{t('stats.bySource.avgWpm')}</th>
                  <th>{t('stats.bySource.bestWpm')}</th>
                  <th>{t('stats.bySource.avgAccuracy')}</th>
                  <th>{t('stats.bySource.last')}</th>
                </tr>
              </thead>
              <tbody>
                {sources.slice(0, 15).map((x) => (
                  <tr key={x.sourceId}>
                    <td>{x.sourceName}</td>
                    <td>{fmt(x.tests)}</td>
                    <td>{fmt(x.avgWpm, 1)}</td>
                    <td>{fmt(x.bestWpm, 1)}</td>
                    <td>{percent(x.avgAccuracy)}</td>
                    <td>{formatDate(x.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>{t('stats.history.title')} <small>({tp('stats.history.count', records.length)})</small></h3>
          {comparing && pair.length === 2 ? (
            <CompareView records={[pair[0], pair[1]]} onClose={() => setComparing(false)} />
          ) : (
            <div className="actions">
              <button className="primary" disabled={pair.length !== 2} onClick={() => setComparing(true)}>{t('stats.comparison.compare')}</button>
              <span className="hint">{t('stats.comparison.pickTwo')}</span>
            </div>
          )}
          <div className="table-scroll">
            <table className="history-table">
              <thead>
                <tr>
                  <th />
                  <th>{t('stats.history.date')}</th>
                  <th>{t('stats.history.type')}</th>
                  <th>{t('stats.history.code')}</th>
                  <th>{t('stats.history.mode')}</th>
                  <th>{t('stats.metrics.wpm')}</th>
                  <th>{t('stats.metrics.accuracy')}</th>
                  <th>{t('stats.metrics.completion')}</th>
                  <th>{t('stats.metrics.errorsMade')}</th>
                  <th>{t('stats.metrics.durationMs')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className={selected.includes(r.id) ? 'selected' : ''}>
                    <td><input type="checkbox" aria-label={t('stats.history.select')} checked={selected.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                    <td>{formatDate(r.finishedAt)}</td>
                    <td>{t(`practice.types.${r.testType}`)}</td>
                    <td>{r.sourceName}</td>
                    <td>{t(`modes.${r.mode}`)}{r.hideGuide && ` · ${t('practice.noGuideTag')}`}</td>
                    <td>{fmt(r.wpm, 1)}</td>
                    <td>{percent(r.accuracy)}</td>
                    <td>{percent(r.completion)}</td>
                    <td>{fmt(r.errorsMade)}</td>
                    <td>{formatTime(r.durationMs)}</td>
                    <td className="row-actions">
                      <button onClick={() => setDetailId(r.id)}>{t('stats.history.view')}</button>
                      <button
                        onClick={() => {
                          if (window.confirm(t('stats.history.confirmRemove'))) {
                            setSelected((s) => s.filter((x) => x !== r.id));
                            void history.remove(r.id);
                          }
                        }}
                      >
                        {t('stats.history.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {all.length > 0 && (
        <div className="actions">
          <button
            className="danger"
            onClick={() => {
              if (window.confirm(tp('stats.history.confirmClear', all.length))) {
                setSelected([]);
                void history.clear();
              }
            }}
          >
            {t('stats.history.clear')}
          </button>
        </div>
      )}
    </section>
  );
}
