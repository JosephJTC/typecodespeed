import { t } from '../../i18n';
import type { SessionSnapshot } from '../../session';
import { fmt, formatTime, percent } from './format';

export function StatsBar({ snapshot: s }: { snapshot: SessionSnapshot }) {
  return (
    <div className="stats-bar">
      <dl className="stats live-stats">
        <Stat main label={s.remainingMs !== undefined ? t('practice.stats.remaining') : t('practice.stats.time')} value={formatTime(s.remainingMs ?? s.elapsedMs)} />
        <Stat main label={t('practice.stats.wpm')} value={fmt(s.wpm)} testId="stat-wpm" />
        <Stat main label={t('practice.stats.accuracy')} value={percent(s.accuracy)} testId="stat-accuracy" />
        <Stat main label={t('practice.stats.errors')} value={fmt(s.uncorrected)} testId="stat-errors" />
        <Stat label={t('practice.stats.progress')} value={t('practice.progressLabel', { done: s.doneChars, total: s.totalChars })} testId="stat-progress" />
        <Stat label={t('practice.stats.tokens')} value={t('practice.of', { value: s.tokensDone, total: s.tokensTotal })} testId="stat-tokens" />
        <Stat label={t('practice.stats.line')} value={t('practice.of', { value: s.line, total: s.lines })} />
      </dl>
      <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(s.progress * 100)} aria-label={t('practice.stats.progress')}>
        <div className="progress-fill" style={{ width: `${s.progress * 100}%` }} />
      </div>
    </div>
  );
}

function Stat({ label, value, testId, main }: { label: string; value: string; testId?: string; main?: boolean }) {
  return (
    <div className={main ? 'stat main' : 'stat'}>
      <dt>{label}</dt>
      <dd data-testid={testId}>{value}</dd>
    </div>
  );
}
