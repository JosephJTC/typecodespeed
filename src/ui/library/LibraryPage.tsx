import { useMemo, useRef } from 'react';
import { t, tp } from '../../i18n';
import { canPickDirectory } from '../../library';
import type { TestRecord } from '../../stats';
import { REF_PREFIX, type PracticeSettings } from '../practice/config';
import { formatDate } from '../stats/labels';
import { Explorer } from './Explorer';
import type { LibraryState } from './useLibrary';

interface Props {
  state: LibraryState;
  settings: PracticeSettings;
  history: readonly TestRecord[];
  /** Applies the source to the settings and opens the practice page. */
  onPractice: (patch: Partial<PracticeSettings>) => void;
}

export function LibraryPage({ state, settings, history, onPractice }: Props) {
  const { library } = state;
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const files = useMemo(() => library?.files ?? [], [library]);
  const pickFiles = (input: HTMLInputElement, name: string) => {
    const list = [...(input.files ?? [])];
    input.value = '';
    return state.importFiles(list, name);
  };

  const importers = (
    <div className="actions">
      {canPickDirectory() ? (
        <button className="primary" disabled={state.busy} onClick={() => void state.pickFolder()}>{t('library.pickFolder')}</button>
      ) : (
        <button className="primary" disabled={state.busy} onClick={() => folderInput.current?.click()}>{t('library.pickFolder')}</button>
      )}
      <button disabled={state.busy} onClick={() => zipInput.current?.click()}>{t('library.importZip')}</button>
      <button disabled={state.busy} onClick={() => filesInput.current?.click()}>{t('library.pickFiles')}</button>
      {state.canRefresh && <button disabled={state.busy} onClick={() => void state.refresh()}>{t('library.refresh')}</button>}
      {library && (
        <button className="danger" disabled={state.busy} onClick={() => window.confirm(t('library.confirmForget')) && void state.forget()}>
          {t('library.forget')}
        </button>
      )}
      <input
        ref={folderInput}
        type="file"
        hidden
        multiple
        aria-label={t('library.pickFolder')}
        // Non-standard attribute: lets Firefox and Safari choose a whole folder.
        {...{ webkitdirectory: '' }}
        onChange={(e) => void pickFiles(e.currentTarget, t('library.defaultName'))}
      />
      <input ref={filesInput} type="file" hidden multiple aria-label={t('library.pickFiles')} onChange={(e) => void pickFiles(e.currentTarget, t('library.looseFiles'))} />
      <input
        ref={zipInput}
        type="file"
        hidden
        accept=".zip,application/zip"
        aria-label={t('library.importZip')}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void state.importZip(file);
        }}
      />
    </div>
  );

  const skipped = library ? library.skipped.tooLarge + library.skipped.unsupported + library.skipped.binary + library.skipped.empty : 0;

  return (
    <section className="library-page">
      <header className="page-head">
        <h2>{t('library.title')}</h2>
        <p className="privacy" role="note">{t('library.privacy')}</p>
      </header>
      {state.busy && <p role="status">{t('library.reading')}</p>}
      {state.error && <p className="bad" role="alert">{t(`library.errors.${state.error}`)}</p>}

      {library === undefined ? (
        <p className="hint">{t('library.loading')}</p>
      ) : library === null ? (
        <div className="empty-state">
          <p>{t('library.intro')}</p>
          {importers}
          <p className="hint">{canPickDirectory() ? t('library.supportNative') : t('library.supportFallback')}</p>
        </div>
      ) : (
        <>
          <p className="library-meta">
            <strong>{library.name}</strong> · {tp('library.fileCount', files.length)} · {t('library.importedAt', { date: formatDate(library.importedAt) })}
            {skipped > 0 && <span className="hint"> · {tp('library.skipped', skipped)}</span>}
          </p>
          {importers}

          <Explorer
            files={files}
            libraryName={library.name}
            history={history}
            historyPrefix={REF_PREFIX}
            initialPath={settings.refPath}
            onPracticeFile={(path, testType) => onPractice({ source: 'ref', refPath: path, testType })}
            onPracticeRandom={(query) => onPractice({ source: 'refRandom', refQuery: query })}
          />
        </>
      )}
    </section>
  );
}
