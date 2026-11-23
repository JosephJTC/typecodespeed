import { useMemo, useState } from 'react';
import { t, tp } from '../../i18n';
import { buildTree, filterFiles, languagesOf, type FileQuery, type LengthFilter, type RefFile, type TreeNode } from '../../library';
import type { TestRecord } from '../../stats';
import type { TestType } from '../practice/config';
import { fmt, percent } from '../practice/format';

interface Props {
  files: readonly RefFile[];
  libraryName: string;
  history: readonly TestRecord[];
  /** History ids of these files start with this prefix followed by the path. */
  historyPrefix: string;
  initialPath: string;
  onPracticeFile: (path: string, testType: TestType) => void;
  onPracticeRandom: (query: FileQuery) => void;
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

/** Folder tree, filters and preview of a set of code files, shared by local references and GitHub. */
export function Explorer({ files, libraryName, history, historyPrefix, initialPath, onPracticeFile, onPracticeRandom }: Props) {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('');
  const [length, setLength] = useState<LengthFilter>('any');
  const [selectedPath, setSelectedPath] = useState(initialPath);

  const query = useMemo(() => ({ text, language: language || undefined, length }), [text, language, length]);
  const filtered = useMemo(() => filterFiles(files, query), [files, query]);
  const tree = useMemo(() => buildTree(filtered), [filtered]);
  const filtering = !!text.trim() || !!language || length !== 'any';
  const selected = files.find((f) => f.path === selectedPath);

  const recent = useMemo(() => {
    const seen = new Map<string, TestRecord[]>();
    for (const r of history) {
      if (!r.sourceId.startsWith(historyPrefix)) continue;
      const path = r.sourceId.slice(historyPrefix.length);
      if (!files.some((f) => f.path === path)) continue;
      seen.set(path, [...(seen.get(path) ?? []), r]);
    }
    return [...seen.entries()].slice(0, 6);
  }, [history, files, historyPrefix]);

  return (
    <>
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
        <button type="button" disabled={filtered.length === 0} onClick={() => onPracticeRandom(query)}>
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
                    {selected.dir || libraryName} · {selected.languageName} · {tp('library.lineCount', selected.lines)}
                  </div>
                </div>
                <div className="actions">
                  <button className="primary" onClick={() => onPracticeFile(selected.path, 'full')}>{t('library.practiceFull')}</button>
                  <button onClick={() => onPracticeFile(selected.path, 'snippet')}>{t('library.practiceSnippet')}</button>
                  <button onClick={() => onPracticeFile(selected.path, 'timed')}>{t('library.practiceTimed')}</button>
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
  );
}
