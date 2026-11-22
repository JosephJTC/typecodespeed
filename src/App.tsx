import { useEffect, useState, type CSSProperties } from 'react';
import { t } from './i18n';
import { LabPage } from './ui/lab/LabPage';
import { LibraryPage } from './ui/library/LibraryPage';
import { useLibrary } from './ui/library/useLibrary';
import { loadSettings, saveSettings, type PracticeSettings } from './ui/practice/config';
import { PracticePage } from './ui/practice/PracticePage';
import { SettingsPage } from './ui/settings/SettingsPage';
import { useHistory } from './ui/stats/history';
import { StatsPage } from './ui/stats/StatsPage';
import './index.css';

const PAGES = ['practice', 'library', 'stats', 'settings', 'lab'] as const;
type Page = (typeof PAGES)[number];

export default function App() {
  const [page, setPage] = useState<Page>('practice');
  const [settings, setSettings] = useState<PracticeSettings>(loadSettings);
  const library = useLibrary();
  const history = useHistory();
  const files = library.library?.files ?? [];

  useEffect(() => saveSettings(settings), [settings]);

  return (
    <div className="app" style={{ '--code-size': `${settings.fontSize}px` } as CSSProperties}>
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">{'</>'}</span>
          <div>
            <h1>{t('app.name')}</h1>
            <p className="tagline">{t('app.tagline')}</p>
          </div>
        </div>
        <nav aria-label={t('nav.label')}>
          {PAGES.map((p) => (
            <button key={p} className={page === p ? 'tab active' : 'tab'} aria-current={page === p ? 'page' : undefined} onClick={() => setPage(p)}>
              {t(`nav.${p}`)}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {page === 'practice' && (
          <PracticePage settings={settings} files={files} onChange={setSettings} onOpenLibrary={() => setPage('library')} onOpenSettings={() => setPage('settings')} />
        )}
        {page === 'library' && (
          <LibraryPage
            state={library}
            settings={settings}
            history={history.records ?? []}
            onPractice={(patch) => {
              setSettings((s) => ({ ...s, ...patch }));
              setPage('practice');
            }}
          />
        )}
        {page === 'stats' && <StatsPage />}
        {page === 'settings' && <SettingsPage settings={settings} onChange={setSettings} />}
        {page === 'lab' && <LabPage />}
      </main>
      <footer className="footer">{t('app.footer')}</footer>
    </div>
  );
}
