import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n';
import { emptyProgress, loadProgress, recordRun, saveProgress, STAGES, type CharResult, type ExerciseSummary, type LearnSettings, type Lesson, type Progress } from '../../learn';
import { Icon } from '../components/Icon';
import { percent } from '../practice/format';
import { ExerciseView } from './ExerciseView';
import { GuidanceMenu } from './GuidanceMenu';
import { KeyboardConfig } from './KeyboardConfig';
import { lessonTitle } from './lessonTitle';
import { ProgressDashboard } from './ProgressDashboard';
import { useKeyboard } from './useKeyboard';

interface Props {
  settings: LearnSettings;
  onChange: (s: LearnSettings) => void;
}

const TABS = ['lessons', 'progress', 'keyboard'] as const;
type Tab = (typeof TABS)[number];

/** Touch-typing tutor: lessons, keyboard configuration and learning progress. */
export function LearnPage({ settings, onChange }: Props) {
  const keyboard = useKeyboard(settings);
  const [tab, setTab] = useState<Tab>('lessons');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);

  useEffect(() => saveProgress(progress), [progress]);

  const { lessons, map } = keyboard;
  const onFinish = useCallback(
    (lesson: Lesson, results: readonly CharResult[], summary: ExerciseSummary) => setProgress((p) => recordRun(p, lesson.id, results, summary, map, Date.now())),
    [map],
  );

  const index = lessons.findIndex((l) => l.id === lessonId);
  if (index >= 0) {
    return (
      <ExerciseView
        lesson={lessons[index]}
        next={lessons[index + 1]}
        keyboard={keyboard}
        settings={settings}
        progress={progress}
        onSettings={onChange}
        onFinish={onFinish}
        onOpen={(l) => setLessonId(l.id)}
        onExit={() => setLessonId(null)}
      />
    );
  }

  const upNext = lessons.find((l) => !progress.lessons[l.id]?.passed);
  const started = Object.keys(progress.lessons).length > 0;

  return (
    <section className="learn-page">
      <header className="page-head">
        <h2>{t('learn.title')}</h2>
        <p className="hint">{t('learn.intro')}</p>
      </header>

      <div className="learn-bar">
        <div className="segments" role="tablist" aria-label={t('learn.tabsLabel')}>
          {TABS.map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'chip active' : 'chip'} onClick={() => setTab(x)}>
              {t(`learn.tabs.${x}`)}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <GuidanceMenu settings={settings} onChange={onChange} />
      </div>

      {tab === 'lessons' && (
        <>
          <div className="card learn-next">
            <div>
              <p className="hint small">
                {t('learn.keyboardSummary', { layout: t(`learn.config.layouts.${settings.layout}`), size: t(`learn.config.sizes.${settings.size}`), geometry: t(`learn.config.geometryShort.${settings.geometry}`) })}{' '}
                <button className="small-btn ghost" onClick={() => setTab('keyboard')}>{t('learn.tabs.keyboard')}</button>
              </p>
              <p className="hint small">{t('learn.homeRowTip')}</p>
            </div>
            {upNext ? (
              <button className="primary large" onClick={() => setLessonId(upNext.id)}>
                <Icon name="play" size={14} />
                {t(started ? 'learn.continue' : 'learn.startFirst', { lesson: lessonTitle(upNext) })}
              </button>
            ) : (
              <p className="good">{t('learn.allDone')}</p>
            )}
          </div>

          {STAGES.map((stage) => {
            const items = lessons.filter((l) => l.stage === stage);
            if (items.length === 0) return null;
            return (
              <section key={stage} className="stage">
                <h3>{t(`learn.stages.s${stage}` as 'learn.stages.s1')}</h3>
                <div className="lesson-grid">
                  {items.map((l) => {
                    const p = progress.lessons[l.id];
                    const status = p?.passed ? 'passed' : p ? 'tried' : 'fresh';
                    return (
                      <button key={l.id} className={`lesson ${status}${l === upNext ? ' next' : ''}`} onClick={() => setLessonId(l.id)} data-lesson={l.id}>
                        <span className="lesson-name">{lessonTitle(l)}</span>
                        <span className="lesson-status">
                          {status === 'fresh' ? (l === upNext ? t('learn.lessonStatus.next') : t('learn.lessonStatus.fresh')) : t(`learn.lessonStatus.${status}`, { accuracy: percent(p!.bestAccuracy) })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <p className="hint small learn-note">{t('learn.honesty')}</p>
        </>
      )}

      {tab === 'progress' && <ProgressDashboard progress={progress} keyboard={keyboard} onReset={() => setProgress(emptyProgress())} />}
      {tab === 'keyboard' && <KeyboardConfig settings={settings} keyboard={keyboard} onChange={onChange} />}
    </section>
  );
}
