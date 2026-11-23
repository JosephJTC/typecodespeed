import { t, tp } from '../../i18n';
import { CustomRules } from '../components/RuleSelect';
import { DEFAULT_SETTINGS, FONT_SIZES, IDLE_OPTIONS, type PracticeSettings } from '../practice/config';

interface Props {
  settings: PracticeSettings;
  onChange: (s: PracticeSettings) => void;
}

export function SettingsPage({ settings: s, onChange }: Props) {
  const set = <K extends keyof PracticeSettings>(k: K, v: PracticeSettings[K]) => onChange({ ...s, [k]: v });
  return (
    <section className="settings-page">
      <h2>{t('settings.title')}</h2>
      <p className="hint">{t('settings.saved')}</p>

      <h3>{t('settings.comparison')}</h3>
      <div className="controls">
        <label>
          {t('lab.mode')}
          <select value={s.mode} onChange={(e) => set('mode', e.target.value as PracticeSettings['mode'])}>
            {(['tolerant', 'exact', 'custom'] as const).map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
          </select>
        </label>
        <label>
          {t('rules.comments')}
          <select value={s.comments} onChange={(e) => set('comments', e.target.value as PracticeSettings['comments'])}>
            <option value="omit">{t('rules.omit')}</option>
            <option value="include">{t('rules.include')}</option>
          </select>
        </label>
      </div>
      <p className="hint">{t(`modeDescriptions.${s.mode}`)}</p>
      {s.mode === 'custom' && <CustomRules value={s.custom} onChange={(v) => set('custom', v)} />}

      <h3>{t('settings.typing')}</h3>
      <div className="controls">
        <label>
          {t('practice.errorPolicy')}
          <select value={s.errorPolicy} onChange={(e) => set('errorPolicy', e.target.value as PracticeSettings['errorPolicy'])}>
            <option value="advance">{t('practice.policies.advance')}</option>
            <option value="block">{t('practice.policies.block')}</option>
          </select>
        </label>
        <label>
          {t('practice.idlePause')}
          <select value={s.idleSec} onChange={(e) => set('idleSec', Number(e.target.value))}>
            {IDLE_OPTIONS.map((d) => <option key={d} value={d}>{d === 0 ? t('practice.idleOff') : tp('practice.secondsPlural', d)}</option>)}
          </select>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={s.autoIndent} onChange={(e) => set('autoIndent', e.target.checked)} />
          {t('practice.autoIndent')}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={s.autoClose} onChange={(e) => set('autoClose', e.target.checked)} />
          {t('practice.autoClose')}
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={s.hideGuide} onChange={(e) => set('hideGuide', e.target.checked)} />
          {t('practice.hideGuide')}
        </label>
      </div>
      {s.hideGuide && <p className="hint">{t('practice.hideGuideHelp')}</p>}

      <h3>{t('settings.appearance')}</h3>
      <div className="controls">
        <label>
          {t('settings.fontSize')}
          <select value={s.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))}>
            {FONT_SIZES.map((n) => <option key={n} value={n}>{t('settings.pixels', { count: n })}</option>)}
          </select>
        </label>
      </div>
      <pre className="preview sample" style={{ fontSize: s.fontSize }}>{'for (int i = 0; i < n; i++) dp[i] = max(dp[i], dp[i - 1] + a[i]);'}</pre>

      <h3>{t('settings.data')}</h3>
      <p className="hint">{t('settings.dataHelp')}</p>
      <div className="actions">
        <button onClick={() => window.confirm(t('settings.confirmReset')) && onChange({ ...DEFAULT_SETTINGS, customCode: s.customCode, refPath: s.refPath })}>{t('settings.reset')}</button>
      </div>
    </section>
  );
}
