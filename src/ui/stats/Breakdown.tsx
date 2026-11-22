import type { ErrorKind, TokenType } from '../../engine';
import { t } from '../../i18n';
import { rankDifficulty, type CharClass, type KeyStat, type Summary } from '../../stats';
import { BarList, type Bar } from '../charts/BarList';
import { fmt, percent } from '../practice/format';
import { charLabel } from './labels';

type Data = Pick<Summary, 'errorsByKind' | 'chars' | 'tokenTypes' | 'charClasses' | 'confusions'>;

const rateText = (s: { errorRate: number; errors: number; attempts: number }) =>
  t('stats.charts.errorRateText', { rate: percent(s.errorRate), errors: s.errors, attempts: s.attempts });

function rateBars<K extends string>(stats: Partial<Record<K, KeyStat>>, label: (k: K) => string, minAttempts: number, code = false): Bar[] {
  return rankDifficulty(stats, minAttempts)
    .filter((s) => s.errors > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors)
    .map((s) => ({ key: s.key, label: label(s.key), code, value: s.errorRate, text: rateText(s) }));
}

/** Error distribution, difficult and slow characters, and code-specific breakdowns for one or many tests. */
export function Breakdown({ data, minAttempts = 2 }: { data: Data; minAttempts?: number }) {
  const kinds = (Object.entries(data.errorsByKind) as Array<[ErrorKind, number]>).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const totalErrors = kinds.reduce((a, [, n]) => a + n, 0);
  const slow = rankDifficulty(data.chars, Math.max(3, minAttempts))
    .filter((s) => s.slowness !== null && s.slowness > 1.25)
    .sort((a, b) => b.slowness! - a.slowness!)
    .slice(0, 8);

  return (
    <div className="chart-grid">
      <BarList
        title={t('stats.charts.errorKinds')}
        emptyText={t('stats.charts.noErrors')}
        bars={kinds.map(([k, n]) => ({ key: k, label: t(`errors.${k}`), value: n, text: t('stats.charts.countText', { count: n, share: percent(n / totalErrors) }) }))}
      />
      <BarList title={t('stats.charts.difficultChars')} emptyText={t('stats.charts.noDifficult')} bars={rateBars(data.chars, charLabel, minAttempts, true).slice(0, 10)} max={1} />
      <BarList
        title={t('stats.charts.slowChars')}
        emptyText={t('stats.charts.noData')}
        color="#d29922"
        bars={slow.map((s) => ({ key: s.key, label: charLabel(s.key), code: true, value: s.avgMs!, text: t('stats.charts.slowText', { ms: fmt(s.avgMs!), times: fmt(s.slowness!, 1) }) }))}
      />
      <BarList
        title={t('stats.charts.confusions')}
        emptyText={t('stats.charts.noErrors')}
        bars={data.confusions.slice(0, 8).map((c) => ({
          key: `${c.expected}|${c.typed}`,
          label: t('stats.charts.confusionLabel', { expected: charLabel(c.expected), typed: charLabel(c.typed) }),
          code: true,
          value: c.count,
          text: String(c.count),
        }))}
      />
      <BarList title={t('stats.charts.tokenTypes')} emptyText={t('stats.charts.noErrors')} bars={rateBars(data.tokenTypes, (k: TokenType) => t(`stats.tokenTypes.${k}`), 1)} max={1} />
      <BarList title={t('stats.charts.charClasses')} emptyText={t('stats.charts.noErrors')} bars={rateBars(data.charClasses, (k: CharClass) => t(`stats.charClasses.${k}`), 1)} max={1} />
    </div>
  );
}
