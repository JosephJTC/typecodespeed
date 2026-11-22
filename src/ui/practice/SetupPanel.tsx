import { t, tp } from '../../i18n';
import { SAMPLES } from '../../snippets';
import { CustomRules } from '../components/RuleSelect';
import { DURATIONS, IDLE_OPTIONS, sourcesFor, type PracticeSettings, type TestType } from './config';

interface Props {
  settings: PracticeSettings;
  onChange: (s: PracticeSettings) => void;
  onStart: () => void;
}

export function SetupPanel({ settings: s, onChange, onStart }: Props) {
  const set = <K extends keyof PracticeSettings>(k: K, v: PracticeSettings[K]) => onChange({ ...s, [k]: v });
  const empty = sourcesFor(s).length === 0;
  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) onStart();
      }}
    >
      <h2>{t('practice.setupTitle')}</h2>
      <fieldset className="segmented">
        <legend>{t('practice.testType')}</legend>
        {(['full', 'timed', 'snippet'] as TestType[]).map((type) => (
          <label key={type} className={s.testType === type ? 'chip active' : 'chip'}>
            <input type="radio" name="testType" checked={s.testType === type} onChange={() => set('testType', type)} />
            {t(`practice.types.${type}`)}
          </label>
        ))}
      </fieldset>
      <p className="hint">{t(`practice.typeDescriptions.${s.testType}`)}</p>

      <div className="controls">
        {s.testType === 'timed' && (
          <label>
            {t('practice.duration')}
            <select value={s.durationSec} onChange={(e) => set('durationSec', Number(e.target.value))}>
              {DURATIONS.map((d) => <option key={d} value={d}>{t('practice.seconds', { count: d })}</option>)}
            </select>
          </label>
        )}
        <label>
          {t('practice.source')}
          <select value={s.source} onChange={(e) => set('source', e.target.value)}>
            {SAMPLES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            <option value="all">{t('practice.allSamples')}</option>
            <option value="custom">{t('practice.customSource')}</option>
          </select>
        </label>
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
      </div>
      <p className="hint">{t(`modeDescriptions.${s.mode}`)}</p>
      {s.mode === 'custom' && <CustomRules value={s.custom} onChange={(v) => set('custom', v)} />}
      {s.source === 'custom' && (
        <textarea
          className="custom-code"
          spellCheck={false}
          placeholder={t('practice.customPlaceholder')}
          value={s.customCode}
          onChange={(e) => set('customCode', e.target.value)}
        />
      )}
      {empty && <p className="bad" role="alert">{t('practice.emptySource')}</p>}
      <div className="actions">
        <button type="submit" className="primary" disabled={empty} autoFocus>{t('practice.start')}</button>
        <span className="hint">{t('practice.startHint')}</span>
      </div>
    </form>
  );
}
