import { useState } from 'react';
import { t } from './i18n';
import { LabPage } from './ui/lab/LabPage';
import { PracticePage } from './ui/practice/PracticePage';
import './index.css';

type Page = 'practice' | 'lab';

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
          {(['practice', 'lab'] as const).map((p) => (
            <button key={p} className={page === p ? 'tab active' : 'tab'} onClick={() => setPage(p)}>
              {t(`nav.${p}`)}
            </button>
          ))}
        </nav>
      </header>
      {page === 'practice' ? <PracticePage /> : <LabPage />}
    </main>
  );
}
