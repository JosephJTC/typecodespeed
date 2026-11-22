import { useMemo, useState } from 'react';
import { buildTarget, evaluate, type CompareOptions, type ComparisonMode, type WhitespaceRules } from '../../engine';
import { t, tp } from '../../i18n';
import { CustomRules } from '../components/RuleSelect';

const SAMPLE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n; cin >> n;
    vector<long long> a(n);
    for (auto &x : a) cin >> x;
    cout << accumulate(a.begin(), a.end(), 0LL) << '\\n';
}`;

const DEFAULT_CUSTOM: WhitespaceRules = { indentation: 'ignore', inlineSpaces: 'collapse', lineBreaks: 'exact', blankLines: 'ignore' };

export function LabPage() {
  const [reference, setReference] = useState(SAMPLE);
  const [typed, setTyped] = useState('#include<bits/stdc++.h>\nusing namespace std;\nint main(){\nint n;cin>>n;\n');
  const [mode, setMode] = useState<ComparisonMode>('tolerant');
  const [comments, setComments] = useState<CompareOptions['comments']>('omit');
  const [custom, setCustom] = useState<WhitespaceRules>(DEFAULT_CUSTOM);

  const options: CompareOptions = { mode, comments, custom };
  const target = useMemo(() => buildTarget(reference, 'cpp', options), [reference, mode, comments, custom]); // eslint-disable-line react-hooks/exhaustive-deps
  const ev = useMemo(() => evaluate(target, typed), [target, typed]);

  const errors = ev.results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.status === 'error')
    .map(({ r }) => {
      const item = target.items[Math.min(r.item, target.items.length - 1)];
      const offset = item ? item.src : target.text.length;
      const before = target.text.slice(0, offset);
      const line = before.split('\n').length;
      const column = offset - before.lastIndexOf('\n');
      return t('lab.errorAt', { line, column, message: t(`errors.${r.error!}`) });
    });

  return (
    <div className="lab">
      <header>
        <h2>{t('lab.title')}</h2>
        <p>{t('lab.intro')}</p>
      </header>

      <section className="controls">
        <label>
          {t('lab.mode')}
          <select value={mode} onChange={(e) => setMode(e.target.value as ComparisonMode)}>
            {(['tolerant', 'exact', 'custom'] as const).map((m) => (
              <option key={m} value={m}>{t(`modes.${m}`)}</option>
            ))}
          </select>
        </label>
        <label>
          {t('rules.comments')}
          <select value={comments} onChange={(e) => setComments(e.target.value as CompareOptions['comments'])}>
            <option value="omit">{t('rules.omit')}</option>
            <option value="include">{t('rules.include')}</option>
          </select>
        </label>
        <p className="hint">{t(`modeDescriptions.${mode}`)}</p>
        {mode === 'custom' && (
          <CustomRules value={custom} onChange={setCustom} />
        )}
      </section>

      <section className="editors">
        <label>
          {t('lab.reference')}
          <textarea spellCheck={false} value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label>
          {t('lab.typed')}
          <textarea spellCheck={false} value={typed} onChange={(e) => setTyped(e.target.value)} />
        </label>
      </section>

      <section className="result">
        <h3>{t('lab.result')}</h3>
        <p className={ev.complete && ev.errors === 0 ? 'ok' : 'bad'}>
          {ev.complete && ev.errors === 0
            ? t('lab.equivalent')
            : !ev.complete
              ? tp('lab.incomplete', ev.counts.remaining)
              : t('lab.notEquivalent')}
        </p>
        <p>{t('lab.stats', { correct: ev.counts.correct, total: ev.counts.total, errors: tp('lab.errorCount', ev.errors) })}</p>
        <h3>{t('lab.target')}</h3>
        <p className="hint">{t('lab.legend')}</p>
        <pre className="target">{renderTarget(target.text, target.items, ev.states)}</pre>
        <h3>{t('lab.errorList')}</h3>
        {errors.length === 0 ? <p>{t('lab.noErrors')}</p> : <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      </section>
    </div>
  );
}

function renderTarget(text: string, items: ReturnType<typeof buildTarget>['items'], states: string[]) {
  const charState: string[] = new Array(text.length).fill('');
  const missedAt = new Set<number>();
  items.forEach((it, i) => {
    if (it.kind === 'char') charState[it.src] = states[i];
    else if (states[i] === 'missed') missedAt.add(it.src);
  });
  const out: React.ReactNode[] = [];
  for (let i = 0; i < text.length; i++) {
    const cls = [charState[i] || 'free', missedAt.has(i) ? 'missed-gap' : ''].join(' ');
    out.push(<span key={i} className={cls}>{text[i]}</span>);
  }
  return out;
}
