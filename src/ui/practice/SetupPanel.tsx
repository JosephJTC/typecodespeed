import { t, tp } from '../../i18n';
import { filterFiles, type Library, type RefFile } from '../../library';
import { SAMPLES } from '../../snippets';
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
      className="setup card"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onStart();
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
        <label className="grow">
          {t('practice.source')}
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
        <label>
          {t('lab.mode')}
          <select value={s.mode} onChange={(e) => set('mode', e.target.value as PracticeSettings['mode'])}>
            {(['tolerant', 'exact', 'custom'] as const).map((m) => <option key={m} value={m}>{t(`modes.${m}`)}</option>)}
          </select>
        </label>
      </div>
      <p className="hint">{t(`modeDescriptions.${s.mode}`)}</p>
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
      <div className="actions">
        <button type="submit" className="primary" disabled={!ready} autoFocus>{t('practice.start')}</button>
        <button type="button" onClick={onOpenLibrary}>{t(files.length > 0 ? 'practice.chooseReference' : 'practice.importReferences')}</button>
        <button type="button" onClick={onOpenSettings}>{t('practice.moreSettings')}</button>
        <span className="hint">{t('practice.startHint')}</span>
      </div>
    </form>
  );
}
