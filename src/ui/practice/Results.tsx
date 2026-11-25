import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { TypingSession } from '../../session';
import { buildRecord, type TestMeta, type TestRecord } from '../../stats';
import { saveRecord, useHistory } from '../stats/history';
import { Icon } from '../components/Icon';
import { RecordDetail } from '../stats/RecordDetail';
import { fmt, formatTime, percent } from './format';

interface Props {
  session: TypingSession;
  meta: TestMeta;
  onRestart: () => void;
  onNext?: () => void;
  onSettings: () => void;
}

const records = new WeakMap<TypingSession, TestRecord>();
const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** One record per session, however many times the results are rendered. */
function recordFor(session: TypingSession, meta: TestMeta): TestRecord {
  let record = records.get(session);
  if (!record) {
    record = buildRecord({ log: session.log, snapshot: session.snapshot(), meta, texts: session.texts, finishedAt: Date.now(), id: newId() });
    records.set(session, record);
  }
  return record;
}

export function Results({ session, meta, onRestart, onNext, onSettings }: Props) {
  const record = recordFor(session, meta);
  const history = useHistory();
  const worthSaving = record.keystrokes > 0;
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (worthSaving) saveRecord(record).catch(() => setSaveFailed(true));
  }, [record, worthSaving]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.ctrlKey || e.metaKey)) return;
      // Let Enter activate the focused control (e.g. «Cambiar configuración»).
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, select, textarea')) return;
      e.preventDefault();
      if (e.shiftKey && onNext) onNext();
      else onRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRestart, onNext]);

  return (
    <section className="results" data-testid="results">
      <header className="results-head">
        <div>
          <h2>{t(`practice.results.${record.finishReason}`)}</h2>
          <p className="hint small">
            {record.sourceName} · {t(`practice.types.${record.testType}`)} · {t(`modes.${record.mode}`)}
            {record.hideGuide && ` · ${t('practice.noGuideTag')}`}
          </p>
        </div>
        <div className="toolbar">
          <button className="primary" onClick={onRestart} title="Ctrl+Enter">
            <Icon name="restart" size={15} />
            {t('practice.restart')}
          </button>
          {onNext && (
            <button onClick={onNext} title="Ctrl+Shift+Enter">
              <Icon name="next" size={15} />
              {t('practice.newSnippet')}
            </button>
          )}
          <button className="ghost" onClick={onSettings}>
            <Icon name="sliders" size={15} />
            {t('practice.settings')}
          </button>
        </div>
      </header>
      <dl className="big-stats">
        <div className="hero"><dt>{t('practice.stats.wpm')}</dt><dd className="big">{fmt(record.wpm)}</dd></div>
        <div><dt>{t('practice.stats.accuracy')}</dt><dd className="big">{percent(record.accuracy)}</dd></div>
        <div><dt>{t('practice.stats.time')}</dt><dd className="big">{formatTime(record.durationMs)}</dd></div>
        <div><dt>{t('practice.results.correctChars')}</dt><dd className="big">{fmt(record.correctChars)}</dd></div>
        <div><dt>{t('practice.results.errorsMade')}</dt><dd className="big">{fmt(record.errorsMade)}</dd></div>
      </dl>
      <p className={saveFailed ? 'bad small' : 'hint small'} role="status">
        {saveFailed ? t('stats.storageError') : worthSaving ? t('stats.saved') : t('stats.notSaved')}
      </p>
      <RecordDetail record={record} history={history.records ?? []} />
    </section>
  );
}
