import { useCallback, useState } from 'react';
import { t } from '../../i18n';
import type { RefFile } from '../../library';
import { TypingSession } from '../../session';
import type { TestMeta } from '../../stats';
import { metaFor, resolveSource, sessionConfig, textsFor, type PracticeSettings, type ResolvedSource } from './config';
import { SetupPanel } from './SetupPanel';
import { TypingView } from './TypingView';

interface Run {
  session: TypingSession;
  text: string;
  source: ResolvedSource;
  /** Settings in effect when the test started (they may change afterwards). */
  meta: TestMeta;
}

interface Props {
  settings: PracticeSettings;
  files: readonly RefFile[];
  onChange: (s: PracticeSettings) => void;
  onOpenLibrary: () => void;
  onOpenSettings: () => void;
}

export function PracticePage({ settings, files, onChange, onOpenLibrary, onOpenSettings }: Props) {
  const [run, setRun] = useState<Run | null>(null);

  const resolve = useCallback(
    (previousId?: string) => resolveSource(settings, files, { all: t('practice.allSamplesShort'), custom: t('practice.customSourceShort') }, Math.random, previousId),
    [settings, files],
  );

  const start = useCallback(
    (previous?: Run, sameSource = false) => {
      // The original text, not `target.text`: the target drops comments when they are omitted.
      const source = sameSource && previous ? previous.source : resolve(previous?.source.id);
      if (!source) return;
      const { first, next } = textsFor(settings, source, Math.random, previous?.session.texts.at(-1));
      if (!first.trim()) return;
      setRun({ session: new TypingSession(first, sessionConfig(settings, source.language, next)), text: first, source, meta: metaFor(settings, source) });
    },
    [settings, resolve],
  );

  const restart = useCallback(() => {
    if (!run) return;
    // Timed tests draw new texts anyway; the others repeat the same text.
    if (settings.testType === 'timed') return start(run, true);
    setRun({ ...run, session: new TypingSession(run.text, sessionConfig(settings, run.source.language)) });
  }, [run, settings, start]);

  if (!run) {
    return <SetupPanel settings={settings} files={files} ready={resolve() !== null} onChange={onChange} onStart={() => start()} onOpenLibrary={onOpenLibrary} onOpenSettings={onOpenSettings} />;
  }
  const canNext = settings.testType !== 'full' || settings.source === 'all' || settings.source === 'refRandom';
  return (
    <TypingView
      session={run.session}
      meta={run.meta}
      onRestart={restart}
      onNext={canNext ? () => start(run) : undefined}
      onSettings={() => setRun(null)}
    />
  );
}
