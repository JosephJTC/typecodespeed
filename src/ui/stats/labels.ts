import { t } from '../../i18n';
import type { ComparedMetric, Insight } from '../../stats';
import { fmt, formatTime, percent } from '../practice/format';

/** Readable name of a character (whitespace is invisible otherwise). */
export function charLabel(ch: string): string {
  if (ch === ' ') return t('stats.keys.space');
  if (ch === '\n') return t('stats.keys.enter');
  if (ch === '\t') return t('stats.keys.tab');
  return ch;
}

const dateFormat = new Intl.DateTimeFormat('es-419', { dateStyle: 'medium', timeStyle: 'short' });
export const formatDate = (ms: number) => dateFormat.format(new Date(ms));

export const signed = (text: string, delta: number) => (delta > 0 ? `+${text}` : text);

export function insightText(i: Insight): string {
  switch (i.kind) {
    case 'lowAccuracy':
      return t('stats.insights.lowAccuracy', { accuracy: percent(i.accuracy) });
    case 'difficultChar':
      return t('stats.insights.difficultChar', { char: charLabel(i.char), rate: percent(i.errorRate), attempts: i.attempts });
    case 'slowChar':
      return t('stats.insights.slowChar', { char: charLabel(i.char), ms: fmt(i.avgMs), times: fmt(i.slowness, 1) });
    case 'confusion':
      return t('stats.insights.confusion', { expected: charLabel(i.expected), typed: charLabel(i.typed), count: i.count });
    case 'errorKind':
      return t('stats.insights.errorKind', { share: percent(i.share), error: t(`errors.${i.error}`), count: i.count });
    case 'tokenType':
      return t('stats.insights.tokenType', { tokenType: t(`stats.tokenTypes.${i.tokenType}`).toLowerCase(), rate: percent(i.errorRate) });
    case 'charClass':
      return t('stats.insights.charClass', { charClass: t(`stats.charClasses.${i.charClass}`).toLowerCase(), rate: percent(i.errorRate) });
    case 'manyCorrections':
      return t('stats.insights.manyCorrections', { count: fmt(i.perHundred) });
    case 'inconsistent':
      return t('stats.insights.inconsistent', { consistency: percent(i.consistency) });
    case 'trend': {
      const delta = i.metric === 'wpm' ? fmt(Math.abs(i.delta), 1) : `${fmt(Math.abs(i.delta) * 100, 1)} puntos`;
      return t(`stats.insights.${i.delta > 0 ? 'trendUp' : 'trendDown'}.${i.metric}`, { delta });
    }
  }
}

const PERCENT: ReadonlySet<ComparedMetric> = new Set(['accuracy', 'consistency', 'completion']);

export function formatMetric(m: ComparedMetric, v: number): string {
  if (PERCENT.has(m)) return percent(v);
  if (m === 'durationMs') return formatTime(v);
  return fmt(v, m === 'cps' || m === 'wpm' || m === 'rawWpm' ? 1 : Number.isInteger(v) ? 0 : 1);
}

export function formatDelta(m: ComparedMetric, delta: number): string {
  if (PERCENT.has(m)) return signed(`${fmt(delta * 100, 1)} pts`, delta);
  if (m === 'durationMs') return signed(`${fmt(delta / 1000, 1)} s`, delta);
  return signed(fmt(delta, Number.isInteger(delta) ? 0 : 1), delta);
}

