import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../i18n';
import { Exercise, generateExercise, keyLabel, learnedChars, PASS_ACCURACY, pressesFor, type CharResult, type CharStat, type ExerciseSummary, type LearnSettings, type Lesson, type Press, type Progress } from '../../learn';
import { Icon } from '../components/Icon';
import { fmt, formatTime, percent } from '../practice/format';
import { GuidanceMenu } from './GuidanceMenu';
import { HandsView } from './HandsView';
import { KeyboardView } from './KeyboardView';
import { lessonTitle } from './lessonTitle';
import type { Keyboard } from './useKeyboard';

interface Props {
  lesson: Lesson;
  /** Lesson that follows, if any. */
  next?: Lesson;
  keyboard: Keyboard;
  settings: LearnSettings;
  progress: Progress;
  onSettings: (s: LearnSettings) => void;
  onFinish: (lesson: Lesson, results: readonly CharResult[], summary: ExerciseSummary) => void;
  onOpen: (lesson: Lesson) => void;
  onExit: () => void;
}

/** Exercise screen: text to type, live feedback, and the keyboard and hands that show which finger to use. */
export function ExerciseView({ lesson, next, keyboard, settings, progress, onSettings, onFinish, onOpen, onExit }: Props) {
  const { layout, board, map, fingers, lessons } = keyboard;
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  const [run, setRun] = useState(0);
  const [, setVersion] = useState(0);
  const [focused, setFocused] = useState(false);
  /** Step of a two-key character (dead key, then letter). */
  const [step, setStep] = useState(0);
  const bump = () => setVersion((v) => v + 1);

  const exercise = useMemo(() => {
    const text = generateExercise({
      lesson,
      learned: learnedChars(lessons, lesson.id),
      language: layout.language,
      stats: new Map<string, CharStat>(Object.entries(progress.chars)),
      bestAccuracy: progress.lessons[lesson.id]?.bestAccuracy || undefined,
      canType: (ch) => map.has(ch),
    });
    return new Exercise(text, lesson.seconds ? lesson.seconds * 1000 : undefined);
    // A new text only when the lesson or the keyboard changes or the user restarts, not on every progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson, lessons, layout, map, run]);

  const reported = useRef<Exercise | null>(null);
  const report = useCallback(() => {
    if (!exercise.finished || reported.current === exercise) return;
    reported.current = exercise;
    if (exercise.results.length > 0) onFinish(lesson, exercise.results, exercise.summary(Date.now()));
  }, [exercise, lesson, onFinish]);

  const finished = exercise.finished;
  useEffect(() => {
    setStep(0);
    inputRef.current?.focus();
  }, [exercise, finished]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!exercise.started || exercise.finished) return;
      exercise.tick(Date.now());
      report();
      bump();
    }, 200);
    return () => window.clearInterval(id);
  }, [exercise, report]);

  const flush = () => {
    const el = inputRef.current;
    if (!el || composing.current || !el.value) return;
    const text = el.value;
    el.value = '';
    for (const ch of text) if (exercise.press(ch, Date.now())) setStep(0);
    report();
    bump();
  };

  const restart = () => setRun((r) => r + 1);
  const now = Date.now();
  const summary = exercise.summary(now);
  const target = exercise.target;
  const strokes = target !== undefined ? map.get(target) : undefined;
  const stroke = strokes?.[Math.min(step, strokes.length - 1)];
  const presses: Press[] = stroke ? pressesFor(stroke, fingers) : [];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onExit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      restart();
    } else if (e.key === 'Enter' && exercise.finished) {
      e.preventDefault();
      if (next && summary.accuracy >= PASS_ACCURACY && summary.completed) onOpen(next);
      else restart();
    } else if (e.key === 'Tab' || e.key === 'Backspace') {
      e.preventDefault();
    } else if (strokes && strokes.length > 1 && step === 0 && e.code === strokes[0].code) {
      setStep(1);
    }
  };

  const keyName = (code: string) => (code === 'Space' ? t('learn.exercise.spaceKey') : t('learn.exercise.keyNamed', { key: keyLabel(layout, code) || (code.startsWith('Shift') ? 'Shift' : code === 'AltRight' ? 'AltGr' : code) }));
  const instruction = () => {
    if (!stroke) return '';
    const finger = (p: Press) => (settings.fingerGuide && p.finger ? ` ${t('learn.exercise.withFinger', { finger: t(`learn.fingers.${p.finger}`) })}` : '');
    const main = presses[presses.length - 1];
    const holds = presses.slice(0, -1).map((p) => (settings.fingerGuide && p.finger ? t('learn.exercise.hold', { key: keyName(p.code), finger: t(`learn.fingers.${p.finger}`) }) : t('learn.exercise.press', { key: keyName(p.code) })));
    const press = strokes && strokes.length > 1 && step === 0 ? t('learn.exercise.deadFirst', { key: keyLabel(layout, main.code) ?? '' }) + finger(main) : t(holds.length ? 'learn.exercise.pressAfter' : 'learn.exercise.press', { key: keyName(main.code) }) + finger(main);
    return [...holds, press].join(` ${t('learn.exercise.then')} `);
  };

  const passed = summary.completed && summary.accuracy >= PASS_ACCURACY;
  const remaining = exercise.remaining(now);

  return (
    <div className="learn-exercise">
      <div className="typing-head">
        <div className="stats-bar">
          <div className="lesson-title">
            <strong>{lessonTitle(lesson)}</strong>
            <span className="hint small">{t(`learn.stages.s${lesson.stage}` as 'learn.stages.s1')}</span>
          </div>
          <dl className="stats live-stats">
            <div className="stat main"><dt>{t(remaining !== undefined ? 'learn.exercise.remaining' : 'learn.exercise.time')}</dt><dd>{formatTime(remaining ?? summary.ms)}</dd></div>
            <div className="stat main"><dt>{t('learn.exercise.accuracy')}</dt><dd data-testid="learn-accuracy">{percent(summary.accuracy)}</dd></div>
            <div className="stat main"><dt>{t('learn.exercise.errors')}</dt><dd data-testid="learn-errors">{fmt(summary.errors)}</dd></div>
            <div className="stat"><dt>{t('learn.exercise.wpm')}</dt><dd>{fmt(summary.wpm)}</dd></div>
            <div className="stat"><dt>{t('learn.exercise.progress')}</dt><dd data-testid="learn-progress">{t('practice.of', { value: exercise.pos, total: exercise.text.length })}</dd></div>
          </dl>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((exercise.pos / exercise.text.length) * 100)} aria-label={t('learn.exercise.progress')}>
            <div className="progress-fill" style={{ width: `${(exercise.pos / exercise.text.length) * 100}%` }} />
          </div>
        </div>
        <div className="toolbar">
          <button className="ghost" onClick={restart} title="Ctrl+Enter"><Icon name="restart" size={15} />{t('learn.exercise.restart')}</button>
          <GuidanceMenu settings={settings} onChange={onSettings} />
          <button className="ghost" onClick={onExit} title="Esc"><Icon name="stop" size={15} />{t('learn.exercise.exit')}</button>
        </div>
      </div>

      {exercise.finished ? (
        <section className="card learn-result" data-testid="learn-result">
          <h3>{passed ? t('learn.result.passed') : !summary.completed ? t('learn.result.stopped') : t('learn.result.retry', { accuracy: percent(PASS_ACCURACY) })}</h3>
          <dl className="big-stats compact">
            <div className="hero"><dt>{t('learn.exercise.accuracy')}</dt><dd className="big">{percent(summary.accuracy)}</dd></div>
            <div><dt>{t('learn.exercise.wpm')}</dt><dd className="big">{fmt(summary.wpm)}</dd></div>
            <div><dt>{t('learn.exercise.errors')}</dt><dd className="big">{fmt(summary.errors)}</dd></div>
            <div><dt>{t('learn.result.chars')}</dt><dd className="big">{fmt(summary.chars)}</dd></div>
            <div><dt>{t('learn.exercise.time')}</dt><dd className="big">{formatTime(summary.ms)}</dd></div>
          </dl>
          <div className="actions">
            {passed && next && <button className="primary" onClick={() => onOpen(next)}><Icon name="next" size={15} />{t('learn.result.next')}</button>}
            <button className={passed && next ? undefined : 'primary'} onClick={restart}><Icon name="restart" size={15} />{t('learn.result.again')}</button>
            <button className="ghost" onClick={onExit}>{t('learn.result.back')}</button>
          </div>
        </section>
      ) : (
        <>
          <div className="typing-area" onMouseDown={(e) => { e.preventDefault(); inputRef.current?.focus(); }}>
            <input
              ref={inputRef}
              className="hidden-input"
              aria-label={t('learn.exercise.target')}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={onKeyDown}
              onInput={flush}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={() => {
                composing.current = false;
                flush();
              }}
              onPaste={(e) => e.preventDefault()}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
            />
            <p className={focused ? 'drill focused' : 'drill'} data-testid="learn-text">
              {exercise.results.map((r, i) => <span key={i} className={r.errors ? 'd-done d-slip' : 'd-done'}>{r.ch}</span>)}
              <span className={exercise.lastWrong !== null ? 'd-current d-wrong' : 'd-current'}>{target === ' ' ? '\u00a0' : target}</span>
              <span className="d-pending">{exercise.text.slice(exercise.pos + 1)}</span>
            </p>
            {!focused && <div className="overlay" role="status">{t('learn.exercise.focusHint')}</div>}
          </div>
          <p className={exercise.lastWrong !== null ? 'instruction bad' : 'instruction'} role="status" data-testid="learn-instruction">
            {exercise.lastWrong !== null && settings.keyHighlight !== 'none' ? `${t('learn.exercise.wrong')} ` : ''}
            {settings.fingerGuide || settings.keyHighlight !== 'none' ? instruction() : exercise.started ? '' : t('learn.exercise.startHint')}
          </p>
          <div className="guide">
            <KeyboardView board={board} layout={layout} fingers={fingers} highlight={settings.keyHighlight} targets={presses} />
            {settings.hands !== 'none' && <HandsView targets={presses} board={board} animated={settings.hands === 'animated'} />}
          </div>
          <p className="hint shortcuts">{exercise.started ? t('learn.exercise.shortcuts') : `${t('learn.exercise.startHint')} · ${t('learn.exercise.shortcuts')}`}</p>
        </>
      )}
      {exercise.finished && (
        // Keeps keyboard shortcuts (Enter, Esc, Ctrl+Enter) working on the result screen.
        <input ref={inputRef} className="hidden-input" aria-hidden="true" tabIndex={-1} onKeyDown={onKeyDown} readOnly />
      )}
    </div>
  );
}
