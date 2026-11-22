// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypingSession } from '../../../session';
import { MemoryHistoryStore, type TestRecord } from '../../../stats';
import { quickRecord } from '../../../stats/__tests__/fixtures';
import { TypingView } from '../../practice/TypingView';
import { setHistoryStore } from '../history';
import { StatsPage } from '../StatsPage';

let store: MemoryHistoryStore;
beforeEach(() => {
  store = new MemoryHistoryStore();
  setHistoryStore(store);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const seed = async (...records: TestRecord[]) => {
  for (const r of records) await store.add(r);
};
const flush = () => act(async () => {});

const older = quickRecord('abcdef;', 'abxdef;', { ms: 400, id: 'older', finishedAt: Date.UTC(2026, 0, 1), meta: { sourceName: 'DSU' } });
const newer = quickRecord('abcdef;', 'abcdef;', { ms: 200, id: 'newer', finishedAt: Date.UTC(2026, 0, 2), meta: { sourceName: 'DSU' } });
const timed = quickRecord('ab;', 'ab;', { id: 'timed', finishedAt: Date.UTC(2026, 0, 3), meta: { testType: 'timed', timeLimitMs: 15000, sourceName: 'BFS' } });

describe('página de estadísticas', () => {
  it('sin historial muestra el mensaje vacío', async () => {
    render(<StatsPage />);
    await flush();
    expect(screen.getByText(/Todavía no hay pruebas guardadas/)).toBeTruthy();
  });

  it('muestra el resumen calculado con las pruebas guardadas', async () => {
    await seed(older, newer);
    render(<StatsPage />);
    await flush();
    const overview = within(screen.getByTestId('overview'));
    expect(overview.getByText('Pruebas').nextSibling?.textContent).toBe('2');
    // older: 2,4 s y 6 correctos al final; newer: 1,2 s y 7 → 13 caracteres en 3,6 s
    expect(overview.getByText('WPM promedio').nextSibling?.textContent).toBe((13 / 5 / (3.6 / 60)).toFixed(1));
    expect(overview.getByText('Mejor WPM').nextSibling?.textContent).toBe(newer.wpm.toFixed(1));
    expect(screen.getAllByText('DSU')).toHaveLength(3);
    expect(within(screen.getByTestId('by-source')).getByText('DSU').closest('tr')!.textContent).toContain('DSU2');
    expect(screen.getByText('Velocidad en cada prueba')).toBeTruthy();
    expect(screen.getByText('c → x')).toBeTruthy();
  });

  it('filtra por tipo de prueba', async () => {
    await seed(older, newer, timed);
    render(<StatsPage />);
    await flush();
    expect(screen.getByText('(3 pruebas)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Tipo de prueba'), { target: { value: 'timed' } });
    expect(screen.getByText('(1 prueba)')).toBeTruthy();
    expect(screen.queryByText('DSU')).toBeNull();
  });

  it('compara dos pruebas seleccionadas', async () => {
    const user = userEvent.setup();
    await seed(older, newer);
    render(<StatsPage />);
    await flush();
    const button = screen.getByRole('button', { name: 'Comparar seleccionadas' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    for (const box of screen.getAllByRole('checkbox')) await user.click(box);
    await user.click(button);
    const cmp = within(screen.getByTestId('compare'));
    const row = cmp.getByText('Errores cometidos').closest('tr')!;
    expect(row.textContent).toContain('1');
    expect(row.textContent).toContain('-1');
    expect(row.textContent).toContain('mejor');
    expect(cmp.getByText('Velocidad: comparación')).toBeTruthy();
  });

  it('abre el detalle de una prueba con sus gráficas', async () => {
    const user = userEvent.setup();
    await seed(older);
    render(<StatsPage />);
    await flush();
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(screen.getByText('Detalle de la prueba')).toBeTruthy();
    expect(screen.getByText('Caracteres por segundo a lo largo de la prueba')).toBeTruthy();
    expect(screen.getByText('Precisión a lo largo de la prueba')).toBeTruthy();
    expect(screen.getByText(/primera prueba de este tipo/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Volver al historial' }));
    expect(screen.getByText('Historial', { exact: false, selector: 'h3' })).toBeTruthy();
  });

  it('elimina una prueba y borra todo con confirmación', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await seed(older, newer);
    render(<StatsPage />);
    await flush();
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    expect((await store.list()).length).toBe(2);
    confirm.mockReturnValue(true);
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    await flush();
    expect((await store.list()).map((r) => r.id)).toEqual(['older']);
    await user.click(screen.getByRole('button', { name: 'Borrar todo el historial' }));
    await flush();
    expect(await store.list()).toEqual([]);
    expect(screen.getByText(/Todavía no hay pruebas guardadas/)).toBeTruthy();
  });
});

describe('resultados de una prueba', () => {
  it('guarda la prueba una sola vez y la compara con el historial', async () => {
    const user = userEvent.setup({ delay: null });
    await seed({ ...older, finishedAt: 1 });
    const session = new TypingSession('ab;', { compare: { mode: 'tolerant', comments: 'omit' }, language: 'cpp', errorPolicy: 'advance', autoIndent: true, idleTimeoutMs: 0 });
    const meta = { testType: 'full', sourceName: 'Prueba', sourceId: 'test', language: 'cpp', mode: 'tolerant', comments: 'omit', errorPolicy: 'advance' } as const;
    const view = render(<TypingView session={session} meta={meta} onRestart={() => {}} onSettings={() => {}} />);
    screen.getByRole('textbox').focus();
    await user.keyboard('ax{Backspace}b;');
    await flush();
    view.rerender(<TypingView session={session} meta={meta} onRestart={() => {}} onSettings={() => {}} />);
    await flush();
    const saved = (await store.list()).filter((r) => r.id !== 'older');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ sourceName: 'Prueba', errorsMade: 1, corrections: 1, uncorrected: 0, completion: 1, finishReason: 'completed' });
    expect(screen.getByText('Resultado guardado en tu historial local.')).toBeTruthy();
    expect(screen.getByText('Frente a tu promedio en 1 prueba anterior del mismo tipo')).toBeTruthy();
    expect(screen.getByText('Distribución de errores')).toBeTruthy();
  });

  it('no guarda una prueba en la que no se escribió nada', async () => {
    const session = new TypingSession('ab;', { compare: { mode: 'tolerant', comments: 'omit' }, language: 'cpp', errorPolicy: 'advance', autoIndent: true, idleTimeoutMs: 0 });
    const meta = { testType: 'full', sourceName: 'Prueba', sourceId: 'test', language: 'cpp', mode: 'tolerant', comments: 'omit', errorPolicy: 'advance' } as const;
    render(<TypingView session={session} meta={meta} onRestart={() => {}} onSettings={() => {}} />);
    act(() => session.abort());
    await flush();
    expect(await store.list()).toEqual([]);
    expect(screen.getByText(/no se guardó/)).toBeTruthy();
  });
});
