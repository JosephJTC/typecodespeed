import { useState } from 'react';
import { MAX_FILES, MIN_PASSPHRASE } from '../../github';
import { t, tp } from '../../i18n';
import type { TestRecord } from '../../stats';
import { Explorer } from '../library/Explorer';
import { ghPrefix, type PracticeSettings } from '../practice/config';
import type { GitHubState } from './useGitHub';

interface Props {
  state: GitHubState;
  settings: PracticeSettings;
  history: readonly TestRecord[];
  onPractice: (patch: Partial<PracticeSettings>) => void;
}

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

function errorText({ key, resetAt }: NonNullable<GitHubState['error']>): string {
  if (key === 'rateLimit') {
    return resetAt ? t('github.errors.rateLimit', { time: new Date(resetAt * 1000).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) }) : t('github.errors.rateLimitNoTime');
  }
  if (key === 'shortPassphrase') return t('github.errors.shortPassphrase', { count: MIN_PASSPHRASE });
  return t(`github.errors.${key}`);
}

function TokenForm({ state }: { state: GitHubState }) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(false);
  const [passphrase, setPassphrase] = useState('');
  const busy = state.busy !== null;

  if (state.hasToken) {
    return (
      <>
        <p className="good" role="status">{t(state.sealed ? 'github.tokenActiveSaved' : 'github.tokenActive')}</p>
        {state.tokenKind === 'classic' && <p className="bad" role="alert">{t('github.classicWarning')}</p>}
        <div className="actions">
          <button className="danger" onClick={() => window.confirm(t('github.confirmForget')) && state.forgetToken()}>{t('github.forgetToken')}</button>
        </div>
      </>
    );
  }

  if (state.sealed) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void state.unlock(passphrase).then(() => setPassphrase(''));
        }}
      >
        <p>{t('github.savedLocked')}</p>
        <div className="controls">
          <label className="grow">
            {t('github.unlockPassphrase')}
            <input type="password" value={passphrase} autoComplete="off" onChange={(e) => setPassphrase(e.target.value)} />
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="primary" disabled={busy || !passphrase}>{t('github.unlock')}</button>
          <button type="button" className="danger" onClick={() => window.confirm(t('github.confirmForget')) && state.forgetToken()}>{t('github.forgetToken')}</button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void state.submitToken(token, remember ? passphrase : null).then((ok) => {
          if (!ok) return;
          setToken('');
          setPassphrase('');
        });
      }}
    >
      <p className="hint">
        {t('github.tokenHelp')}{' '}
        <a href={TOKEN_URL} target="_blank" rel="noopener noreferrer">{t('github.tokenLink')}</a>
      </p>
      <div className="controls">
        <label className="grow">
          {t('github.tokenLabel')}
          <input type="password" value={token} placeholder={t('github.tokenPlaceholder')} autoComplete="off" spellCheck={false} autoCapitalize="off" onChange={(e) => setToken(e.target.value)} />
        </label>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> {t('github.remember')}
      </label>
      {remember && (
        <div className="controls">
          <label className="grow">
            {t('github.passphrase')}
            <input type="password" value={passphrase} autoComplete="new-password" minLength={MIN_PASSPHRASE} onChange={(e) => setPassphrase(e.target.value)} />
          </label>
          <p className="hint">{t('github.passphraseHint', { count: MIN_PASSPHRASE })}</p>
        </div>
      )}
      <div className="actions">
        <button type="submit" className="primary" disabled={busy || !token.trim()}>{t('github.submitToken')}</button>
        {state.busy === 'token' && <span role="status">{t('github.checking')}</span>}
      </div>
      <p className="hint">{t('github.noTokenHint', { count: MAX_FILES.anonymous })}</p>
    </form>
  );
}

export function GitHubPage({ state, settings, history, onPractice }: Props) {
  const [input, setInput] = useState('');
  const [ref, setRef] = useState('');
  const loaded = state.repo;

  return (
    <section className="library-page github-page">
      <header className="page-head">
        <h2>{t('github.title')}</h2>
        <p className="hint">{t('github.intro')}</p>
        <p className="privacy" role="note">{t('github.privacy')}</p>
      </header>
      {state.error && <p className="bad" role="alert">{errorText(state.error)}</p>}

      <div className="github-panels">
        <div className="card">
          <h3>{t('github.access')}</h3>
          <TokenForm state={state} />
        </div>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void state.open(input, ref);
          }}
        >
          <h3>{t('github.repository')}</h3>
          <div className="controls">
            <label className="grow">
              {t('github.repoLabel')}
              <input value={input} list="github-repos" placeholder={t('github.repoPlaceholder')} autoComplete="off" spellCheck={false} autoCapitalize="off" onChange={(e) => setInput(e.target.value)} />
            </label>
            <label>
              {t('github.refLabel')}
              <input value={ref} placeholder={t('github.refPlaceholder')} autoComplete="off" spellCheck={false} autoCapitalize="off" onChange={(e) => setRef(e.target.value)} />
            </label>
          </div>
          <datalist id="github-repos">
            {state.repos.map((r) => <option key={r} value={r} />)}
          </datalist>
          {state.repos.length > 0 && <p className="hint">{tp('github.yourRepos', state.repos.length)}</p>}
          <div className="actions">
            <button type="submit" className="primary" disabled={state.busy !== null || !input.trim()}>{t('github.open')}</button>
            {state.busy === 'repo' && <button type="button" onClick={state.cancel}>{t('github.cancel')}</button>}
            {state.busy === 'repo' && (
              <span role="status">{state.progress ? t('github.progress', { done: state.progress.done, total: state.progress.total }) : t('github.loading')}</span>
            )}
          </div>
        </form>
      </div>

      {loaded && (
        <>
          <p className="library-meta">
            <strong>{loaded.library.name}</strong> · {t(loaded.isPrivate ? 'github.private' : 'github.public')} · {tp('library.fileCount', loaded.library.files.length)}{' '}
            <button type="button" className="small-btn" onClick={state.close}>{t('github.close')}</button>
          </p>
          {loaded.truncated && <p className="hint">{t('github.truncated')}</p>}
          {loaded.capped > 0 && <p className="hint">{tp('github.capped', loaded.capped)}</p>}
          <Explorer
            key={loaded.library.name + loaded.library.importedAt}
            files={loaded.library.files}
            libraryName={loaded.library.name}
            history={history}
            historyPrefix={ghPrefix(loaded.library.name)}
            initialPath={settings.ghPath}
            onPracticeFile={(path, testType) => onPractice({ source: 'gh', ghPath: path, testType })}
            onPracticeRandom={(query) => onPractice({ source: 'ghRandom', ghQuery: query })}
          />
        </>
      )}
    </section>
  );
}
