import { t, tp } from '../../i18n';
import { filterFiles, type Library, type RefFile } from '../../library';
import { SAMPLES } from '../../snippets';
import { Icon } from '../components/Icon';
import { DURATIONS, type PracticeSettings, type TestType } from './config';

interface Props {
  settings: PracticeSettings;
  files: readonly RefFile[];
  repo: Library | null;
  /** Whether the current source has code to practice. */
  ready: boolean;
  onChange: (s: PracticeSettings) => void;
  onStart: () => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

export function SetupPanel({ settings: s, files, repo, ready, onChange, onStart, onOpenLibrary, onOpenSettings }: Props) {
  const set = <K extends keyof PracticeSettings>(k: K, v: PracticeSettings[K]) => onChange({ ...s, [k]: v });
  const refFile = files.find((f) => f.path === s.refPath);
  const pool = filterFiles(files, s.refQuery).length;
  const ghFile = repo?.files.find((f) => f.path === s.ghPath);
  const ghPool = repo ? filterFiles(repo.files, s.ghQuery).length : 0;
  return (
    <form
      className="setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onStart();
      }}
    >
      <header className="page-head">
        <h2>{t('practice.setupTitle')}</h2>
        <p className="hint">{t(`practice.typeDescriptions.${s.testType}`)}</p>
      </header>

      <div className="card setup-card">
        <div className="setup-row">
          <fieldset className="segmented">
            <legend>{t('practice.testType')}</legend>
            <div className="segments">
              {(['full', 'timed', 'snippet'] as TestType[]).map((type) => (
                <label key={type} className={s.testType === type ? 'chip active' : 'chip'}>
                  <input type="radio" name="testType" checked={s.testType === type} onChange={() => set('testType', type)} />
                  {t(`practice.types.${type}`)}
                </label>
              ))}
            </div>
          </fieldset>
          {s.testType === 'timed' && (
            <fieldset className="segmented">
              <legend>{t('practice.duration')}</legend>
              <div className="segments">
                {DURATIONS.map((d) => (
                  <label key={d} className={s.durationSec === d ? 'chip active' : 'chip'}>
                    <input type="radio" name="duration" checked={s.durationSec === d} onChange={() => set('durationSec', d)} />
                    {t('practice.seconds', { count: d })}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="setup-row">
          <label className="field grow">
            <span className="field-label">{t('practice.source')}</span>
            <select value={s.source} onChange={(e) => set('source', e.target.value)}>
              {files.length > 0 && (
                <optgroup label={t('practice.myReferences')}>
                  <option value="ref">{refFile ? t('practice.refSelected', { path: refFile.path }) : t('practice.refNone')}</option>
                  <option value="refRandom">{tp('practice.refRandom', pool)}</option>
                </optgroup>
              )}
              {repo && (
                <optgroup label={t('practice.githubGroup', { repo: repo.name })}>
                  <option value="gh">{ghFile ? t('practice.refSelected', { path: ghFile.path }) : t('practice.refNone')}</option>
                  <option value="ghRandom">{tp('practice.refRandom', ghPool)}</option>
                </optgroup>
              )}
              <optgroup label={t('practice.samples')}>
                {SAMPLES.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                <option value="all">{t('practice.allSamples')}</option>
              </optgroup>
              <optgroup label={t('practice.other')}>
                <option value="custom">{t('practice.customSource')}</option>
              </optgroup>
            </select>
          </label>
          <label className="field" title={t(`modeDescriptions.${s.mode}`)}>
            <span className="field-label">{t('lab.mode')}</span>
            <select value={s.mode} onChange={(e) => set('mode', e.target.value as PracticeSettings['mode'])}>
              {(['tolerant', 'exact', 'custom'] as const).map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
            </select>
          </label>
        </div>
        <p className="hint small">{t(`modeDescriptions.${s.mode}`)}</p>

        <label className="switch-row">
          <input type="checkbox" className="switch" checked={s.hideGuide} onChange={(e) => set('hideGuide', e.target.checked)} />
          <span>{t('practice.hideGuide')}</span>
        </label>
        {s.hideGuide && <p className="hint small">{t('practice.hideGuideHelp')}</p>}

        {s.source === 'custom' && (
          <textarea
            className="custom-code"
            spellCheck={false}
            placeholder={t('practice.customPlaceholder')}
            value={s.customCode}
            onChange={(e) => set('customCode', e.target.value)}
          />
        )}
        {!ready && <p className="bad" role="alert">{t(s.source === 'custom' ? 'practice.emptySource' : s.source === 'gh' || s.source === 'ghRandom' ? 'practice.missingGitHub' : 'practice.missingRef')}</p>}

        <div className="setup-actions">
          <button type="submit" className="primary large" disabled={!ready} autoFocus>
            <Icon name="play" size={14} />
            {t('practice.start')}
          </button>
          <span className="hint small"><kbd>Enter</kbd></span>
          <span className="spacer" />
          <button type="button" className="ghost" onClick={onOpenLibrary}>
            <Icon name="library" size={16} />
            {t(files.length > 0 ? 'practice.chooseReference' : 'practice.importReferences')}
          </button>
          <button type="button" className="ghost" onClick={onOpenSettings}>
            <Icon name="sliders" size={16} />
            {t('practice.moreSettings')}
          </button>
        </div>
      </div>
    </form>
  );
}
