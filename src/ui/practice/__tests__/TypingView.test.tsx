// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypingSession } from '../../../session';
import { TypingView } from '../TypingView';

afterEach(cleanup);

function setup(text: string, policy: 'advance' | 'block' = 'advance', onSettings = () => {}) {
  const session = new TypingSession(text, {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: policy,
    autoIndent: true,
    idleTimeoutMs: 0,
  });
  const onRestart = vi.fn();
  render(<TypingView session={session} onRestart={onRestart} onSettings={onSettings} />);
  const input = screen.getByRole('textbox') as HTMLTextAreaElement;
  return { session, input, onRestart };
}

describe('TypingView', () => {
  it('captura cada tecla escrita rápidamente, incluidos errores y retrocesos', async () => {
    const user = userEvent.setup({ delay: null });
    const { session, input } = setup('int main() {\n    return 0;\n}');
    input.focus();
    await user.keyboard('int mian');
    expect(session.snapshot().uncorrected).toBe(2);
    await user.keyboard('{Backspace}{Backspace}{Backspace}ain(){{{Enter}return 0;{Enter}}');
    expect(screen.getByTestId('results')).toBeTruthy();
    const snap = session.snapshot();
    expect(snap.status).toBe('finished');
    expect(snap.uncorrected).toBe(0);
    expect(snap.errorsMade).toBe(2);
    expect(snap.corrections).toBe(3);
  });

  it('una ráfaga en un solo evento input no pierde caracteres', () => {
    const { session, input } = setup('a+b;');
    act(() => {
      input.value = 'a+b';
      fireEvent.input(input);
    });
    expect(session.snapshot().doneChars).toBe(3);
    expect(input.value).toBe('');
    expect(screen.getByTestId('stat-progress').textContent).toBe('3 de 4 caracteres');
  });

  it('no procesa texto durante la composición (IME) hasta que termina', () => {
    const { session, input } = setup('a+b;');
    act(() => {
      fireEvent.compositionStart(input);
      input.value = 'a';
      fireEvent.input(input);
    });
    expect(session.snapshot().doneChars).toBe(0);
    act(() => {
      fireEvent.compositionEnd(input);
    });
    expect(session.snapshot().doneChars).toBe(1);
  });

  it('Esc pausa y muestra el aviso; perder el foco también pausa', async () => {
    const user = userEvent.setup({ delay: null });
    const { session, input } = setup('abc;');
    input.focus();
    await user.keyboard('a{Escape}');
    expect(session.status).toBe('paused');
    expect(screen.getByRole('status').textContent).toContain('En pausa');
    await user.keyboard('b');
    expect(session.status).toBe('running');
    act(() => input.blur());
    expect(session.snapshot().pauseReason).toBe('blur');
  });

  it('modo bloquear: la tecla incorrecta no avanza', async () => {
    const user = userEvent.setup({ delay: null });
    const { session, input } = setup('int x;', 'block');
    input.focus();
    await user.keyboard('intx');
    expect(session.snapshot().doneChars).toBe(3);
    await user.keyboard(' x;');
    expect(session.status).toBe('finished');
  });

  it('no permite pegar texto', () => {
    const { session, input } = setup('abc;');
    act(() => {
      fireEvent.paste(input, { clipboardData: { getData: () => 'abc;' } });
    });
    expect(session.snapshot().doneChars).toBe(0);
    expect(screen.getByText('No se permite pegar texto durante la prueba.')).toBeTruthy();
  });

  it('Ctrl+Enter reinicia', async () => {
    const user = userEvent.setup({ delay: null });
    const { input, onRestart } = setup('abc;');
    input.focus();
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onRestart).toHaveBeenCalled();
  });
});

describe('Resultados', () => {
  it('Enter activa el botón enfocado y, sin foco en un botón, reinicia', async () => {
    const user = userEvent.setup({ delay: null });
    const onSettings = vi.fn();
    const { input, onRestart } = setup('a;', 'advance', onSettings);
    input.focus();
    await user.keyboard('a;');
    screen.getByRole('button', { name: 'Cambiar configuración' }).focus();
    await user.keyboard('{Enter}');
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(onRestart).not.toHaveBeenCalled();
    (document.activeElement as HTMLElement).blur();
    await user.keyboard('{Enter}');
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('volver a enfocar después de perder el foco reanuda la prueba', () => {
    const { session, input } = setup('abc;');
    act(() => {
      input.focus();
      session.input('a');
      input.blur();
    });
    expect(session.status).toBe('paused');
    act(() => input.focus());
    expect(session.status).toBe('running');
  });
});
