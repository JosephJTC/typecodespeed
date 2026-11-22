import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import type { TypingSession } from '../../session';
import { buildRecord, type TestMeta, type TestRecord } from '../../stats';
import { saveRecord, useHistory } from '../stats/history';
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
      if (e.key !== 'Enter') return;
      // Let Enter activate the focused control (e.g. «Cambiar configuración»).
      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, select, textarea')) return;
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && onNext) onNext();
      else onRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRestart, onNext]);

  return (
    <section className="results" data-testid="results">
      <h2>{t(`practice.results.${record.finishReason}`)}</h2>
      <div className="big-stats">
        <div><span className="big">{fmt(record.wpm)}</span><span>{t('practice.stats.wpm')}</span></div>
        <div><span className="big">{percent(record.accuracy)}</span><span>{t('practice.stats.accuracy')}</span></div>
        <div><span className="big">{formatTime(record.durationMs)}</span><span>{t('practice.stats.time')}</span></div>
      </div>
      <div className="actions">
        <button onClick={onRestart}>{t('practice.restart')}</button>
        {onNext && <button onClick={onNext}>{t('practice.newSnippet')}</button>}
        <button onClick={onSettings}>{t('practice.settings')}</button>
      </div>
      <p className="hint">{t('practice.shortcuts')}</p>
      <p className={saveFailed ? 'bad' : 'hint'} role="status">
        {saveFailed ? t('stats.storageError') : worthSaving ? t('stats.saved') : t('stats.notSaved')}
      </p>
      <RecordDetail record={record} history={history.records ?? []} />
    </section>
  );
}
