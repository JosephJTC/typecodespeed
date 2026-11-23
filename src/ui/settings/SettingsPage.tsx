import { useId, type ReactElement, type ReactNode } from 'react';
import { t, tp } from '../../i18n';
import { CustomRules } from '../components/RuleSelect';
import { DEFAULT_SETTINGS, FONT_SIZES, IDLE_OPTIONS, THEMES, type PracticeSettings } from '../practice/config';

interface Props {
  settings: PracticeSettings;
  onChange: (s: PracticeSettings) => void;
}

/** One setting: label and help on the left, its control on the right. */
function Row({ label, help, children }: { label: string; help?: string; children: (id: string) => ReactElement }) {
  const id = useId();
  return (
    <div className="setting-row">
      <div className="setting-text">
        <label htmlFor={id}>{label}</label>
        {help && <p className="hint small">{help}</p>}
      </div>
      <div className="setting-control">{children(id)}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h3>{title}</h3>
      <div className="card settings-card">{children}</div>
    </section>
  );
}

export function SettingsPage({ settings: s, onChange }: Props) {
  const set = <K extends keyof PracticeSettings>(k: K, v: PracticeSettings[K]) => onChange({ ...s, [k]: v });
  const toggle = (k: 'autoIndent' | 'autoClose' | 'hideGuide' | 'fingerGuide') => (id: string) => (
    <input id={id} type="checkbox" className="switch" checked={s[k]} onChange={(e) => set(k, e.target.checked)} />
  );
  return (
    <section className="settings-page">
      <header className="page-head">
        <h2>{t('settings.title')}</h2>
        <p className="hint">{t('settings.saved')}</p>
      </header>

      <Group title={t('settings.comparison')}>
        <Row label={t('settings.modeLabel')} help={t(`modeDescriptions.${s.mode}`)}>
          {(id) => (
            <select id={id} value={s.mode} onChange={(e) => set('mode', e.target.value as PracticeSettings['mode'])}>
              {(['tolerant', 'exact', 'custom'] as const).map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
            </select>
          )}
        </Row>
        {s.mode === 'custom' && (
          <div className="setting-row nested">
            <CustomRules value={s.custom} onChange={(v) => set('custom', v)} />
          </div>
        )}
        <Row label={t('rules.comments')} help={t('settings.commentsHelp')}>
          {(id) => (
            <select id={id} value={s.comments} onChange={(e) => set('comments', e.target.value as PracticeSettings['comments'])}>
              <option value="omit">{t('rules.omit')}</option>
              <option value="include">{t('rules.include')}</option>
            </select>
          )}
        </Row>
      </Group>

      <Group title={t('settings.typing')}>
        <Row label={t('practice.errorPolicy')} help={t('settings.errorPolicyHelp')}>
          {(id) => (
            <select id={id} value={s.errorPolicy} onChange={(e) => set('errorPolicy', e.target.value as PracticeSettings['errorPolicy'])}>
              <option value="advance">{t('practice.policies.advance')}</option>
              <option value="block">{t('practice.policies.block')}</option>
            </select>
          )}
        </Row>
        <Row label={t('practice.idlePause')} help={t('settings.idleHelp')}>
          {(id) => (
            <select id={id} value={s.idleSec} onChange={(e) => set('idleSec', Number(e.target.value))}>
              {IDLE_OPTIONS.map((d) => <option key={d} value={d}>{d === 0 ? t('practice.idleOff') : tp('practice.secondsPlural', d)}</option>)}
            </select>
          )}
        </Row>
        <Row label={t('practice.autoIndent')} help={t('settings.autoIndentHelp')}>{toggle('autoIndent')}</Row>
        <Row label={t('practice.autoClose')} help={t('settings.autoCloseHelp')}>{toggle('autoClose')}</Row>
        <Row label={t('practice.hideGuide')} help={t('practice.hideGuideHelp')}>{toggle('hideGuide')}</Row>
        <Row label={t('practice.fingerGuide')} help={t('practice.fingerGuideHelp')}>{toggle('fingerGuide')}</Row>
      </Group>

      <Group title={t('settings.appearance')}>
        <Row label={t('settings.theme')} help={t('settings.themeHelp')}>
          {(id) => (
            <select id={id} value={s.theme} onChange={(e) => set('theme', e.target.value as PracticeSettings['theme'])}>
              {THEMES.map((x) => <option key={x} value={x}>{t(`settings.themes.${x}`)}</option>)}
            </select>
          )}
        </Row>
        <Row label={t('settings.fontSize')} help={t('settings.fontSizeHelp')}>
          {(id) => (
            <select id={id} value={s.fontSize} onChange={(e) => set('fontSize', Number(e.target.value))}>
              {FONT_SIZES.map((n) => <option key={n} value={n}>{t('settings.pixels', { count: n })}</option>)}
            </select>
          )}
        </Row>
        <pre className="preview sample" style={{ fontSize: s.fontSize }}>{'for (int i = 0; i < n; i++) dp[i] = max(dp[i], dp[i - 1] + a[i]);'}</pre>
      </Group>

      <Group title={t('settings.data')}>
        <div className="setting-row">
          <div className="setting-text">
            <p className="hint small">{t('settings.dataHelp')}</p>
          </div>
          <div className="setting-control">
            <button className="danger" onClick={() => window.confirm(t('settings.confirmReset')) && onChange({ ...DEFAULT_SETTINGS, customCode: s.customCode, refPath: s.refPath, learn: s.learn })}>{t('settings.reset')}</button>
          </div>
        </div>
      </Group>
    </section>
  );
}
