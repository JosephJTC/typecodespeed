import { t } from '../../i18n';
import { LEVELS, levelOf, type GuidanceLevel, type HandsMode, type KeyHighlight, type LearnSettings } from '../../learn';
import { Icon } from '../components/Icon';

interface Props {
  settings: LearnSettings;
  onChange: (s: LearnSettings) => void;
}

/** Guidance preferences, tucked into a small menu so they do not clutter the exercise. */
export function GuidanceMenu({ settings: s, onChange }: Props) {
  const level = levelOf(s);
  return (
    <details className="menu">
      <summary className="ghost-summary">
        <Icon name="sliders" size={15} />
        {t('learn.exercise.guidance')}
      </summary>
      <div className="menu-panel card">
        <strong>{t('learn.guidance.title')}</strong>
        <label>
          {t('learn.guidance.level')}
          <select value={level} onChange={(e) => e.target.value !== 'custom' && onChange({ ...s, ...LEVELS[e.target.value as GuidanceLevel] })}>
            {(Object.keys(LEVELS) as GuidanceLevel[]).map((l) => <option key={l} value={l}>{t(`learn.guidance.levels.${l}`)}</option>)}
            {level === 'custom' && <option value="custom">{t('learn.guidance.levels.custom')}</option>}
          </select>
        </label>
        <label>
          {t('learn.guidance.keyHighlight')}
          <select value={s.keyHighlight} onChange={(e) => onChange({ ...s, keyHighlight: e.target.value as KeyHighlight })}>
            {(['fingers', 'target', 'none'] as const).map((v) => <option key={v} value={v}>{t(`learn.guidance.keyHighlights.${v}`)}</option>)}
          </select>
        </label>
        <label>
          {t('learn.guidance.hands')}
          <select value={s.hands} onChange={(e) => onChange({ ...s, hands: e.target.value as HandsMode })}>
            {(['animated', 'static', 'none'] as const).map((v) => <option key={v} value={v}>{t(`learn.guidance.handsModes.${v}`)}</option>)}
          </select>
        </label>
        <label className="switch-row">
          <input type="checkbox" className="switch" checked={s.fingerGuide} onChange={(e) => onChange({ ...s, fingerGuide: e.target.checked })} />
          <span>{t('learn.guidance.fingerGuide')}</span>
        </label>
      </div>
    </details>
  );
}
