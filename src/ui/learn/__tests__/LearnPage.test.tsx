// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../../App';
import { parseProgress } from '../../../learn';
import { MemoryLibraryStore } from '../../../library';
import { MemoryHistoryStore } from '../../../stats';
import { setLibraryStore } from '../../library/useLibrary';
import { parseSettings } from '../../practice/config';
import { setHistoryStore } from '../../stats/history';

beforeEach(() => {
  localStorage.clear();
  setHistoryStore(new MemoryHistoryStore());
  setLibraryStore(new MemoryLibraryStore());
});
afterEach(cleanup);

async function openLearn() {
  const user = userEvent.setup({ delay: null });
  render(<App />);
  await act(async () => {});
  await user.click(screen.getByRole('button', { name: 'Aprender' }));
  return user;
}

const drillText = () => screen.getByTestId('learn-text').textContent!.replace(/\u00a0/g, ' ');
const saved = () => parseSettings(localStorage.getItem('typecodespeed.settings')).learn;

describe('sección Aprender', () => {
  it('una lección completa: guía, error, resultado y progreso guardado', async () => {
    const user = await openLearn();
    await user.click(screen.getByRole('button', { name: /Empezar: Teclas F J/ }));
    const text = drillText();
    expect(text.startsWith('fff jjj')).toBe(true);
    expect([...text].every((ch) => 'fj '.includes(ch))).toBe(true);

    expect(screen.getByTestId('learn-instruction').textContent).toBe('Pulsa la tecla F con el índice izquierdo');
    expect(document.querySelector('.kb-key.target')?.getAttribute('data-code')).toBe('KeyF');
    expect(document.querySelector('.hands .finger.on')?.getAttribute('data-finger')).toBe('l-index');

    await user.keyboard('x');
    expect(screen.getByTestId('learn-errors').textContent).toBe('1');
    expect(screen.getByTestId('learn-progress').textContent).toBe(`0 / ${text.length}`);
    expect(screen.getByTestId('learn-instruction').textContent).toContain('Esa no es');

    await user.keyboard(text);
    const result = screen.getByTestId('learn-result');
    expect(within(result).getByText('¡Lección completada!')).toBeTruthy();
    const progress = parseProgress(localStorage.getItem('typecodespeed.learn'));
    expect(progress.lessons['home-fj']).toMatchObject({ runs: 1, passed: true });
    expect(progress.chars.f.errors).toBe(1);

    await user.click(within(result).getByRole('button', { name: 'Siguiente lección' }));
    expect(screen.getByText('Teclas D K')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('button', { name: /Continuar: Teclas D K/ })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Progreso' }));
    expect(within(screen.getByTestId('learn-overview')).getByText('1 de 29')).toBeTruthy();
  });

  it('la configuración del teclado se guarda y cambia las lecciones y el teclado dibujado', async () => {
    const user = await openLearn();
    expect(screen.getByRole('button', { name: /Teclas A Ñ/ })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Mi teclado' }));
    expect(document.querySelector('[data-code="IntlBackslash"]')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Distribución'), { target: { value: 'en-us' } });
    fireEvent.change(screen.getByLabelText('Tamaño'), { target: { value: '60' } });
    expect(saved()).toMatchObject({ layout: 'en-us', geometry: 'ansi', size: '60' });
    expect(document.querySelector('[data-code="IntlBackslash"]')).toBeNull();
    expect(document.querySelector('[data-code="F1"]')).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Lecciones' }));
    expect(screen.getByRole('button', { name: /Teclas A ;/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Acentos/ })).toBeNull();
  });

  it('la detección guiada propone una distribución y avisa si no está segura', async () => {
    const user = await openLearn();
    await user.click(screen.getByRole('tab', { name: 'Mi teclado' }));
    await user.click(screen.getByRole('button', { name: 'Detectar mi teclado' }));
    const detector = screen.getByTestId('detector');
    fireEvent.keyDown(window, { code: 'KeyZ', key: 'z' });
    fireEvent.keyDown(window, { code: 'Equal', key: '=' });
    fireEvent.keyDown(window, { code: 'Backslash', key: '\\' });
    expect(within(detector).getByText('Distribución más probable: Inglés (EE. UU.), forma ANSI.')).toBeTruthy();
    expect(within(detector).queryByRole('note')).toBeNull();
    await user.click(within(detector).getByRole('button', { name: 'Usar esta configuración' }));
    expect(saved()).toMatchObject({ layout: 'en-us', geometry: 'ansi' });

    await user.click(screen.getByRole('button', { name: 'Detectar mi teclado' }));
    fireEvent.keyDown(window, { code: 'IntlBackslash', key: '<' });
    await user.click(screen.getByRole('button', { name: 'Omitir este paso' }));
    await user.click(screen.getByRole('button', { name: 'Omitir este paso' }));
    expect(screen.getByRole('note').textContent).toContain('Revisa la propuesta');
  });

  it('el nivel avanzado quita la guía y se conserva', async () => {
    const user = await openLearn();
    fireEvent.change(screen.getByLabelText('Nivel de guía'), { target: { value: 'advanced' } });
    expect(saved()).toMatchObject({ fingerGuide: false, keyHighlight: 'none', hands: 'none' });
    await user.click(screen.getByRole('button', { name: /Empezar: Teclas F J/ }));
    expect(document.querySelector('.kb-key.target')).toBeNull();
    expect(document.querySelector('.hands')).toBeNull();
    expect(screen.getByTestId('learn-instruction').textContent).not.toContain('índice');
  });
});
