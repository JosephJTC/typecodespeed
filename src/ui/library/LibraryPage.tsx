import { useMemo, useRef, useState } from 'react';
import { t, tp } from '../../i18n';
import { buildTree, canPickDirectory, filterFiles, languagesOf, type LengthFilter, type RefFile, type TreeNode } from '../../library';
import type { TestRecord } from '../../stats';
import { REF_PREFIX, type PracticeSettings } from '../practice/config';
import { fmt, percent } from '../practice/format';
import { formatDate } from '../stats/labels';
import type { LibraryState } from './useLibrary';

interface Props {
  state: LibraryState;
  settings: PracticeSettings;
  history: readonly TestRecord[];
  /** Applies the source to the settings and opens the practice page. */
  onPractice: (patch: Partial<PracticeSettings>) => void;
}

function Folder({ node, selected, onSelect, depth }: { node: TreeNode; selected: string; onSelect: (f: RefFile) => void; depth: number }) {
  return (
    <ul className="tree" role={depth === 0 ? 'tree' : 'group'}>
      {node.folders.map((f) => (
        <li key={f.path} role="treeitem" aria-selected={false}>
          <details open={depth === 0 && node.folders.length <= 4}>
            <summary>
              <span className="folder-name">{f.name}</span> <span className="count">{f.total}</span>
            </summary>
            <Folder node={f} selected={selected} onSelect={onSelect} depth={depth + 1} />
          </details>
        </li>
      ))}
      {node.files.map((f) => (
        <li key={f.path} role="treeitem" aria-selected={f.path === selected}>
          <button type="button" className={f.path === selected ? 'file active' : 'file'} onClick={() => onSelect(f)}>
            {f.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function LibraryPage({ state, settings, history, onPractice }: Props) {
  const { library } = state;
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('');
  const [length, setLength] = useState<LengthFilter>('any');
  const [selectedPath, setSelectedPath] = useState(settings.refPath);
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);

  const files = useMemo(() => library?.files ?? [], [library]);
  const query = useMemo(() => ({ text, language: language || undefined, length }), [text, language, length]);
  const filtered = useMemo(() => filterFiles(files, query), [files, query]);
  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const filtering = !!text.trim() || !!language || length !== 'any';
  const selected = files.find((f) => f.path === selectedPath);

  const recent = useMemo(() => {
    const seen = new Map<string, TestRecord[]>();
    for (const r of history) {
      if (!r.sourceId.startsWith(REF_PREFIX)) continue;
      const path = r.sourceId.slice(REF_PREFIX.length);
      if (!files.some((f) => f.path === path)) continue;
      seen.set(path, [...(seen.get(path) ?? []), r]);
    }
    return [...seen.entries()].slice(0, 6);
  }, [history, files]);

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
      <h2>{t('library.title')}</h2>
      <p className="privacy" role="note">{t('library.privacy')}</p>
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
          <p>
            <strong>{library.name}</strong> · {tp('library.fileCount', files.length)} · {t('library.importedAt', { date: formatDate(library.importedAt) })}
            {skipped > 0 && <span className="hint"> · {tp('library.skipped', skipped)}</span>}
          </p>
          {importers}

          {recent.length > 0 && (
            <>
              <h3>{t('library.recent')}</h3>
              <ul className="recent">
                {recent.map(([path, records]) => (
                  <li key={path}>
                    <button type="button" className="file" onClick={() => setSelectedPath(path)}>{path}</button>
                    <span className="hint">
                      {tp('stats.history.count', records.length)} · {t('library.bestWpm', { wpm: fmt(Math.max(...records.map((r) => r.wpm)), 1) })} · {percent(records[0].accuracy)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="controls filters">
            <label className="grow">
              {t('library.search')}
              <input type="search" value={text} placeholder={t('library.searchPlaceholder')} onChange={(e) => setText(e.target.value)} />
            </label>
            <label>
              {t('library.language')}
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">{t('library.anyLanguage')}</option>
                {languagesOf(files).map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </label>
            <label>
              {t('library.length')}
              <select value={length} onChange={(e) => setLength(e.target.value as LengthFilter)}>
                {(['any', 'short', 'medium', 'long'] as const).map((l) => <option key={l} value={l}>{t(`library.lengths.${l}`)}</option>)}
              </select>
            </label>
            <button type="button" disabled={filtered.length === 0} onClick={() => onPractice({ source: 'refRandom', refQuery: query })}>
              {t('library.practiceRandom', { count: filtered.length })}
            </button>
          </div>

          <div className="explorer">
            <div className="explorer-list" data-testid="explorer-list">
              {filtered.length === 0 ? (
                <p className="hint">{t('library.noMatches')}</p>
              ) : filtering ? (
                <ul className="tree flat">
                  {filtered.slice(0, 200).map((f) => (
                    <li key={f.path}>
                      <button type="button" className={f.path === selectedPath ? 'file active' : 'file'} onClick={() => setSelectedPath(f.path)}>
                        {f.path}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <Folder node={tree} selected={selectedPath} onSelect={(f) => setSelectedPath(f.path)} depth={0} />
              )}
            </div>
            <div className="explorer-preview">
              {selected ? (
                <>
                  <div className="preview-head">
                    <div>
                      <strong>{selected.name}</strong>
                      <div className="hint">
                        {selected.dir || library.name} · {selected.languageName} · {tp('library.lineCount', selected.lines)}
                      </div>
                    </div>
                    <div className="actions">
                      <button className="primary" onClick={() => onPractice({ source: 'ref', refPath: selected.path, testType: 'full' })}>{t('library.practiceFull')}</button>
                      <button onClick={() => onPractice({ source: 'ref', refPath: selected.path, testType: 'snippet' })}>{t('library.practiceSnippet')}</button>
                      <button onClick={() => onPractice({ source: 'ref', refPath: selected.path, testType: 'timed' })}>{t('library.practiceTimed')}</button>
                    </div>
                  </div>
                  {selected.language !== 'cpp' && <p className="hint">{t('library.plainLanguage')}</p>}
                  <pre className="preview" tabIndex={0}>{selected.text}</pre>
                </>
              ) : (
                <p className="hint">{t('library.selectHint')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
