import { useEffect } from 'react';
import type { ErrorKind } from '../../engine';
import { t } from '../../i18n';
import type { SessionSnapshot } from '../../session';
import { formatTime, percent } from './format';

interface Props {
  snapshot: SessionSnapshot;
  onRestart: () => void;
  onNext?: () => void;
  onSettings: () => void;
}

export function Results({ snapshot: s, onRestart, onNext, onSettings }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && onNext) onNext();
      else onRestart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onRestart, onNext]);

  const fmt = (n: number) => new Intl.NumberFormat('es-419', { maximumFractionDigits: 0 }).format(n);
  const kinds = Object.entries(s.errorsByKind) as Array<[ErrorKind, number]>;
  return (
    <section className="results" data-testid="results">
      <h2>{t(`practice.results.${s.finishReason ?? 'completed'}`)}</h2>
      <div className="big-stats">
        <div><span className="big">{fmt(s.wpm)}</span><span>{t('practice.stats.wpm')}</span></div>
        <div><span className="big">{percent(s.accuracy)}</span><span>{t('practice.stats.accuracy')}</span></div>
        <div><span className="big">{formatTime(s.elapsedMs)}</span><span>{t('practice.stats.time')}</span></div>
      </div>
      <dl className="stats">
        <div className="stat"><dt>{t('practice.stats.rawWpm')}</dt><dd>{fmt(s.rawWpm)}</dd></div>
        <div className="stat"><dt>{t('practice.results.correctChars')}</dt><dd>{fmt(s.sessionCorrectChars)}</dd></div>
        <div className="stat"><dt>{t('practice.results.errorsMade')}</dt><dd>{fmt(s.errorsMade)}</dd></div>
        <div className="stat"><dt>{t('practice.results.uncorrected')}</dt><dd>{fmt(s.uncorrected)}</dd></div>
        <div className="stat"><dt>{t('practice.results.corrections')}</dt><dd>{fmt(s.corrections)}</dd></div>
        <div className="stat"><dt>{t('practice.results.tokensCorrect')}</dt><dd>{t('practice.of', { value: s.tokensCorrect, total: s.tokensTotal })}</dd></div>
        {s.textsCompleted > 0 && <div className="stat"><dt>{t('practice.results.texts')}</dt><dd>{fmt(s.textsCompleted)}</dd></div>}
      </dl>
      <h3>{t('practice.results.byKind')}</h3>
      {kinds.length === 0 ? <p>{t('practice.results.none')}</p> : (
        <ul>{kinds.map(([k, n]) => <li key={k}>{t(`errors.${k}`)}: {fmt(n)}</li>)}</ul>
      )}
      <div className="actions">
        <button autoFocus onClick={onRestart}>{t('practice.restart')}</button>
        {onNext && <button onClick={onNext}>{t('practice.newSnippet')}</button>}
        <button onClick={onSettings}>{t('practice.settings')}</button>
      </div>
      <p className="hint">{t('practice.shortcuts')}</p>
    </section>
  );
}
