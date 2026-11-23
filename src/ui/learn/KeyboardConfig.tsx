import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import { DETECT_STEPS, detectLayout, LAYOUT_IDS, LAYOUTS, SIZE_IDS, type Detection, type Geometry, type Hand, type KeySample, type LayoutId, type LearnSettings, type SizeId } from '../../learn';
import { KeyboardView } from './KeyboardView';
import type { Keyboard } from './useKeyboard';

interface Props {
  settings: LearnSettings;
  keyboard: Keyboard;
  onChange: (s: LearnSettings) => void;
}

/** Characters the lessons would use that this keyboard cannot type directly. */
const WANTED = '()[]{}<>=+*/_#&|\\@$%;:?!\'"-';

function Detector({ current, onApply, onClose }: { current: LayoutId; onApply: (d: Detection) => void; onClose: () => void }) {
  const [samples, setSamples] = useState<Array<KeySample | null>>([]);
  const done = samples.length >= DETECT_STEPS.length;

  useEffect(() => {
    if (done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      // Modifiers alone say nothing about the layout.
      if (['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'Tab'].includes(e.key)) return;
      e.preventDefault();
      setSamples((s) => [...s, { code: e.code, key: e.key }]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onClose]);

  const result = done ? detectLayout(samples, current) : null;
  return (
    <section className="card detector" data-testid="detector">
      <strong>{t('learn.detect.title')}</strong>
      <p className="hint small">{t('learn.detect.explain')}</p>
      {result ? (
        <>
          <p role="status">
            {result.reason === 'noCodes'
              ? t('learn.detect.uncertain.noCodes')
              : t('learn.detect.result', { layout: t(`learn.config.layouts.${result.layout}`), geometry: t(`learn.config.geometryShort.${result.geometry}`) })}
          </p>
          {result.uncertain && result.reason && result.reason !== 'noCodes' && <p className="hint small" role="note">{t(`learn.detect.uncertain.${result.reason}`)}</p>}
          <div className="actions">
            {result.reason !== 'noCodes' && <button className="primary" onClick={() => onApply(result)}>{t('learn.detect.apply')}</button>}
            <button onClick={() => setSamples([])}>{t('learn.detect.retry')}</button>
            <button className="ghost" onClick={onClose}>{t('learn.detect.cancel')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="hint small">{t('learn.detect.step', { n: samples.length + 1, total: DETECT_STEPS.length })}</p>
          <p className="detect-step" role="status">{t(`learn.detect.steps.${DETECT_STEPS[samples.length].id}`)}</p>
          <div className="actions">
            <button onClick={() => setSamples((s) => [...s, null])}>{t('learn.detect.skip')}</button>
            <button className="ghost" onClick={onClose}>{t('learn.detect.cancel')}</button>
          </div>
        </>
      )}
    </section>
  );
}

/** Layout, shape and size of the user's keyboard, with an optional guided detection. */
export function KeyboardConfig({ settings: s, keyboard, onChange }: Props) {
  const [detecting, setDetecting] = useState(false);
  const missing = [...WANTED].filter((ch) => !keyboard.map.has(ch));
  return (
    <section className="keyboard-config">
      <div className="card config-card">
        <div className="controls">
          <label>
            {t('learn.config.layout')}
            {/* Choosing a layout also selects the shape it is usually sold with. */}
            <select value={s.layout} onChange={(e) => onChange({ ...s, layout: e.target.value as LayoutId, geometry: LAYOUTS[e.target.value as LayoutId].geometry })}>
              {LAYOUT_IDS.map((id) => <option key={id} value={id}>{t(`learn.config.layouts.${id}`)}</option>)}
            </select>
          </label>
          <label>
            {t('learn.config.geometry')}
            <select value={s.geometry} onChange={(e) => onChange({ ...s, geometry: e.target.value as Geometry })}>
              {(['ansi', 'iso'] as const).map((g) => <option key={g} value={g}>{t(`learn.config.geometries.${g}`)}</option>)}
            </select>
          </label>
          <label>
            {t('learn.config.size')}
            <select value={s.size} onChange={(e) => onChange({ ...s, size: e.target.value as SizeId })}>
              {SIZE_IDS.map((id) => <option key={id} value={id}>{t(`learn.config.sizes.${id}`)}</option>)}
            </select>
          </label>
          <label>
            {t('learn.config.spaceThumb')}
            <select value={s.spaceThumb} onChange={(e) => onChange({ ...s, spaceThumb: e.target.value as Hand })}>
              {(['left', 'right'] as const).map((h) => <option key={h} value={h}>{t(`learn.config.thumbs.${h}`)}</option>)}
            </select>
          </label>
          {!detecting && <button onClick={() => setDetecting(true)}>{t('learn.detect.start')}</button>}
        </div>
        <p className="hint small">{t('learn.config.help')}</p>
      </div>
      {detecting && (
        <Detector
          current={s.layout}
          onClose={() => setDetecting(false)}
          onApply={(d) => {
            onChange({ ...s, layout: d.layout, geometry: d.geometry });
            setDetecting(false);
          }}
        />
      )}
      <div className="guide">
        <KeyboardView board={keyboard.board} layout={keyboard.layout} fingers={keyboard.fingers} highlight="fingers" />
      </div>
      <p className="hint small">{t('learn.config.preview')}</p>
      {missing.length > 0 && <p className="hint small" role="note">{t('learn.config.missing', { chars: missing.join(' ') })}</p>}
    </section>
  );
}
