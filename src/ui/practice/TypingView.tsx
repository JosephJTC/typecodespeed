import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '../../i18n';
import type { LearnSettings } from '../../learn';
import type { TypingSession } from '../../session';
import type { TestMeta } from '../../stats';
import { Icon } from '../components/Icon';
import { FingerGuide } from '../learn/FingerGuide';
import { fingerName, guidePresses } from '../learn/guide';
import { useKeyboard } from '../learn/useKeyboard';
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
  /** Keyboard and guidance preferences, when the finger guide is on. */
  guide?: LearnSettings;
}

/**
 * Captures keyboard input with a hidden textarea: printable characters arrive
 * through `input` (so fast typing, dead keys and IME are not lost), and control
 * keys are handled in `keydown`. Every event is applied synchronously to the
 * session, which is the single source of truth.
 */
export function TypingView({ session, meta, onRestart, onNext, onSettings, guide }: Props) {
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
    if (typeof action === 'object') {
      session.move(action.move, e.shiftKey);
      return;
    }
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
      case 'delete':
        session.deleteForward();
        break;
      case 'wordDelete':
        session.wordDelete();
        break;
      case 'selectAll':
        session.selectAll();
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
    <div className={guide ? 'typing with-guide' : 'typing'}>
      <div className="typing-head">
        <StatsBar snapshot={snap} />
        <div className="toolbar" role="toolbar" aria-label={t('practice.controls')}>
          <button className="ghost" onClick={onRestart} title="Ctrl+Enter">
            <Icon name="restart" size={15} />
            {t('practice.restart')}
          </button>
          {onNext && (
            <button className="ghost" onClick={onNext} title="Ctrl+Shift+Enter">
              <Icon name="next" size={15} />
              {t('practice.newSnippet')}
            </button>
          )}
          <button className="ghost" onClick={() => session.abort()}>
            <Icon name="stop" size={15} />
            {t('practice.finish')}
          </button>
          <button className="ghost" onClick={onSettings}>
            <Icon name="sliders" size={15} />
            {t('practice.settings')}
          </button>
        </div>
      </div>
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
        <CodeView display={session.display()} version={version} focused={focused} />
        {snap.status === 'paused' && <div className="overlay" role="status">{t(`practice.paused.${snap.pauseReason ?? 'user'}`)}</div>}
        {!focused && snap.status !== 'paused' && <div className="overlay" role="status">{t('practice.focusHint')}</div>}
      </div>
      {guide && <PracticeGuide session={session} settings={guide} />}
      <div className="typing-foot">
        <p className={notice ? 'bad small' : 'hint small'}>
          {notice || (snap.status === 'ready' ? t(session.hideGuide ? 'practice.noGuideTyping' : 'practice.typingHint') : `${t('practice.stats.time')}: ${formatTime(snap.elapsedMs)}`)}
        </p>
        <p className="hint shortcuts">{t('practice.shortcuts')}</p>
      </div>
    </div>
  );
}

/** Keyboard, hands and finger for the next character of the code. */
function PracticeGuide({ session, settings }: { session: TypingSession; settings: LearnSettings }) {
  const keyboard = useKeyboard(settings);
  const next = session.nextChar();
  // Accented letters take two keys; the guide shows the letter's own key last, so start with the accent.
  const stroke = next === undefined ? undefined : keyboard.map.get(next)?.[0];
  const name = settings.fingerGuide ? fingerName(guidePresses(keyboard, stroke)) : '';
  return (
    <div className="practice-guide" data-testid="practice-guide">
      <FingerGuide keyboard={keyboard} settings={settings} stroke={stroke} />
      {name && <p className="hint small finger-name">{name}</p>}
    </div>
  );
}
