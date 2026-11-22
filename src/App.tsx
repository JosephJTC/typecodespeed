import { useState } from 'react';
import { t } from './i18n';
import { LabPage } from './ui/lab/LabPage';
import { PracticePage } from './ui/practice/PracticePage';
import { StatsPage } from './ui/stats/StatsPage';
import './index.css';

type Page = 'practice' | 'stats' | 'lab';

export default function App() {
  const [page, setPage] = useState<Page>('practice');
  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>{t('app.name')}</h1>
          <p className="tagline">{t('app.tagline')}</p>
        </div>
        <nav>
          {(['practice', 'stats', 'lab'] as const).map((p) => (
            <button key={p} className={page === p ? 'tab active' : 'tab'} onClick={() => setPage(p)}>
              {t(`nav.${p}`)}
            </button>
          ))}
        </nav>
      </header>
      {page === 'practice' ? <PracticePage /> : page === 'stats' ? <StatsPage /> : <LabPage />}
    </main>
  );
}
