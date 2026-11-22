import { useCallback, useState } from 'react';
import { TypingSession } from '../../session';
import { t } from '../../i18n';
import type { TestMeta } from '../../stats';
import { DEFAULT_SETTINGS, metaFor, sessionConfig, textsFor, type PracticeSettings } from './config';
import { SetupPanel } from './SetupPanel';
import { TypingView } from './TypingView';

interface Run {
  session: TypingSession;
  text: string;
  /** Settings in effect when the test started (they may change afterwards). */
  meta: TestMeta;
}

export function PracticePage() {
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_SETTINGS);
  const [run, setRun] = useState<Run | null>(null);

  const start = useCallback(
    (previous?: string) => {
      const { first, next } = textsFor(settings, Math.random, previous);
      if (!first.trim()) return;
      setRun({ session: new TypingSession(first, sessionConfig(settings, next)), text: first, meta: metaFor(settings, { all: t('practice.allSamplesShort'), custom: t('practice.customSourceShort') }) });
    },
    [settings],
  );

  const restart = useCallback(() => {
    if (!run) return;
    // Timed tests draw new texts anyway; the others repeat the same text.
    if (settings.testType === 'timed') return start();
    setRun({ session: new TypingSession(run.text, sessionConfig(settings)), text: run.text, meta: run.meta });
  }, [run, settings, start]);

  if (!run) return <SetupPanel settings={settings} onChange={setSettings} onStart={() => start()} />;
  return (
    <TypingView
      session={run.session}
      meta={run.meta}
      onRestart={restart}
      onNext={settings.testType !== 'full' || settings.source === 'all' ? () => start(run.session.target.text) : undefined}
      onSettings={() => setRun(null)}
    />
  );
}
