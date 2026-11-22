import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '../../i18n';
import type { TypingSession } from '../../session';
import type { TestMeta } from '../../stats';
import { CodeView } from './CodeView';
import { keyAction } from './keyboard';
import { Results } from './Results';
import { formatTime } from './format';
import { StatsBar } from './StatsBar';

interface Props {
  session: TypingSession;
  meta: TestMeta;
  onRestart: () => void;
  onNext?: () => void;
  onSettings: () => void;
}

/**
 * Captures keyboard input with a hidden textarea: printable characters arrive
 * through `input` (so fast typing, dead keys and IME are not lost), and control
 * keys are handled in `keydown`. Every event is applied synchronously to the
 * session, which is the single source of truth.
 */
export function TypingView({ session, meta, onRestart, onNext, onSettings }: Props) {
  const version = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.version,
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composing = useRef(false);
  const [focused, setFocused] = useState(false);
  const [notice, setNotice] = useState('');
  const [, setClock] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, [session]);

  useEffect(() => {
    const id = window.setInterval(() => {
      session.tick();
      if (session.status === 'running') setClock((c) => c + 1);
    }, 100);
    return () => window.clearInterval(id);
  }, [session]);

  const snap = session.snapshot();
  const finished = snap.status === 'finished';

  const flush = () => {
    const el = inputRef.current;
    if (!el || composing.current || !el.value) return;
    const text = el.value;
    el.value = '';
    session.input(text);
  };

  /** Clicking the code keeps or restores focus; clicks on its scrollbars keep their default behavior. */
  const focusInput = (e: React.MouseEvent<HTMLDivElement>) => {
    const view = (e.target as HTMLElement).closest('.code-view');
    if (view) {
      const r = view.getBoundingClientRect();
      const onScrollbar = e.clientX - r.left >= view.clientLeft + view.clientWidth || e.clientY - r.top >= view.clientTop + view.clientHeight;
      if (onScrollbar) return;
    }
    e.preventDefault();
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const action = keyAction(e.nativeEvent);
    if (!action) return;
    e.preventDefault();
    flush();
    switch (action) {
      case 'enter':
        session.input('\n');
        break;
      case 'tab':
        session.tab();
        break;
      case 'backspace':
        session.backspace();
        break;
      case 'wordBackspace':
        session.wordBackspace();
        break;
      case 'pause':
        session.togglePause();
        break;
      case 'restart':
        onRestart();
        break;
      case 'next':
        (onNext ?? onRestart)();
        break;
    }
  };

  if (finished) return <Results session={session} meta={meta} onRestart={onRestart} onNext={onNext} onSettings={onSettings} />;

  return (
    <div className="typing">
      <StatsBar snapshot={snap} />
      <div className="typing-area" onMouseDown={focusInput}>
        <textarea
          ref={inputRef}
          className="hidden-input"
          aria-label={t('practice.focusHint')}
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
          onPaste={(e) => {
            e.preventDefault();
            setNotice(t('practice.noPaste'));
          }}
          onFocus={() => {
            setFocused(true);
            if (session.snapshot().pauseReason === 'blur') session.resume();
          }}
          onBlur={() => {
            setFocused(false);
            session.pause('blur');
          }}
        />
        <CodeView
          target={session.target}
          states={session.evaluator.states}
          extras={session.evaluator.extras}
          caret={session.caretOffset()}
          version={version}
          focused={focused}
        />
        {snap.status === 'paused' && <div className="overlay" role="status">{t(`practice.paused.${snap.pauseReason ?? 'user'}`)}</div>}
        {!focused && snap.status !== 'paused' && <div className="overlay" role="status">{t('practice.focusHint')}</div>}
      </div>
      <p className="hint">
        {notice || (snap.status === 'ready' ? t('practice.typingHint') : `${t('practice.stats.time')}: ${formatTime(snap.elapsedMs)}`)}
      </p>
      <p className="hint shortcuts">{t('practice.shortcuts')}</p>
      <div className="actions">
        <button onClick={onRestart}>{t('practice.restart')}</button>
        {onNext && <button onClick={onNext}>{t('practice.newSnippet')}</button>}
        <button onClick={() => session.abort()}>{t('practice.finish')}</button>
        <button onClick={onSettings}>{t('practice.settings')}</button>
      </div>
    </div>
  );
}
