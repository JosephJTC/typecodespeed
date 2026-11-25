import { useEffect, useState, type CSSProperties } from 'react';
import { t } from './i18n';
import { Icon } from './ui/components/Icon';
import { GitHubPage } from './ui/github/GitHubPage';
import { useGitHub } from './ui/github/useGitHub';
import { LabPage } from './ui/lab/LabPage';
import { LearnPage } from './ui/learn/LearnPage';
import { LibraryPage } from './ui/library/LibraryPage';
import { useLibrary } from './ui/library/useLibrary';
import { loadSettings, saveSettings, type Palette, type PracticeSettings, type Theme } from './ui/practice/config';
import { PracticePage } from './ui/practice/PracticePage';
import { SettingsPage } from './ui/settings/SettingsPage';
import { useHistory } from './ui/stats/history';
import { StatsPage } from './ui/stats/StatsPage';
import './index.css';

const PAGES = ['practice', 'learn', 'library', 'stats', 'settings', 'lab'] as const;
type Page = (typeof PAGES)[number];
type LibraryTab = 'local' | 'github';

const COLLAPSED_KEY = 'typecodespeed.sidebar';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Applies the theme to the document, following the operating system when it is `system`. */
function useTheme(theme: Theme) {
  useEffect(() => {
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;
    const apply = () => {
      const resolved = theme === 'system' ? (media?.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = resolved;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f6f7f9' : '#0d1017');
    };
    apply();
    if (theme !== 'system' || !media) return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

/** Applies the accent color palette to the document. */
function usePalette(palette: Palette) {
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
  }, [palette]);
}

export default function App() {
  const [page, setPage] = useState<Page>('practice');
  const [settings, setSettings] = useState<PracticeSettings>(loadSettings);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('local');
  const library = useLibrary();
  const github = useGitHub();
  const history = useHistory();
  const files = library.library?.files ?? [];

  useEffect(() => saveSettings(settings), [settings]);
  useTheme(settings.theme);
  usePalette(settings.palette);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? 'expanded' : 'collapsed');
      } catch {
        // Without storage the choice lasts until the page is closed.
      }
      return !c;
    });
  };

  return (
    <div className={collapsed ? 'app collapsed' : 'app'} style={{ '--code-size': `${settings.fontSize}px` } as CSSProperties}>
      <aside className="sidebar">
        <div className="brand" title={t('app.tagline')}>
          <span className="logo" aria-hidden="true">{'</>'}</span>
          <div className="brand-text">
            <h1>{t('app.name')}</h1>
            <p className="tagline">{t('app.tagline')}</p>
          </div>
        </div>
        <nav aria-label={t('nav.label')}>
          {PAGES.map((p) => (
            <button
              key={p}
              className={page === p ? 'tab active' : 'tab'}
              aria-current={page === p ? 'page' : undefined}
              title={t(`nav.${p}`)}
              onClick={() => setPage(p)}
            >
              <Icon name={p} />
              <span className="tab-label">{t(`nav.${p}`)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="footer">{t('app.footer')}</p>
          <button className="collapse-toggle" onClick={toggleCollapsed} aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')} title={t(collapsed ? 'nav.expand' : 'nav.collapse')}>
            <Icon name={collapsed ? 'expand' : 'collapse'} size={16} />
          </button>
        </div>
      </aside>
      <main className={`page page-${page}`}>
        {page === 'practice' && (
          <PracticePage settings={settings} files={files} repo={github.repo?.library ?? null} onChange={setSettings} onOpenLibrary={() => setPage('library')} onOpenSettings={() => setPage('settings')} />
        )}
        {page === 'learn' && <LearnPage settings={settings.learn} onChange={(learn) => setSettings((s) => ({ ...s, learn }))} />}
        {page === 'library' && (
          <section className="library-shell">
            <div className="learn-bar">
              <div className="segments" role="tablist" aria-label={t('library.tabsLabel')}>
                {(['local', 'github'] as const).map((x) => (
                  <button key={x} role="tab" aria-selected={libraryTab === x} className={libraryTab === x ? 'chip active' : 'chip'} onClick={() => setLibraryTab(x)}>
                    {t(`library.tabs.${x}`)}
                  </button>
                ))}
              </div>
            </div>
            {libraryTab === 'local' ? (
              <LibraryPage
                state={library}
                settings={settings}
                history={history.records ?? []}
                onPractice={(patch) => {
                  setSettings((s) => ({ ...s, ...patch }));
                  setPage('practice');
                }}
              />
            ) : (
              <GitHubPage
                state={github}
                settings={settings}
                history={history.records ?? []}
                onPractice={(patch) => {
                  setSettings((s) => ({ ...s, ...patch }));
                  setPage('practice');
                }}
              />
            )}
          </section>
        )}
        {page === 'stats' && <StatsPage />}
        {page === 'settings' && <SettingsPage settings={settings} onChange={setSettings} />}
        {page === 'lab' && <LabPage />}
      </main>
    </div>
  );
}
