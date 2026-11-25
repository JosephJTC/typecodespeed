// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TypingSession } from '../../../session';
import { DEFAULT_LEARN, type LearnSettings } from '../../../learn';
import { TypingView } from '../TypingView';

const META = { testType: 'full', sourceName: 'Prueba', sourceId: 'test', language: 'cpp', mode: 'tolerant', comments: 'omit', errorPolicy: 'advance' } as const;

afterEach(cleanup);

function setup(text: string, policy: 'advance' | 'block' = 'advance', onSettings = () => {}, guide?: LearnSettings) {
  const session = new TypingSession(text, {
    compare: { mode: 'tolerant', comments: 'omit' },
    language: 'cpp',
    errorPolicy: policy,
    autoIndent: true,
    idleTimeoutMs: 0,
  });
  const onRestart = vi.fn();
  render(<TypingView session={session} meta={META} onRestart={onRestart} onSettings={onSettings} guide={guide} />);
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

  it('muestra los espacios y saltos escritos y acomoda el código pendiente después', async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = setup('int main() {\n    return 0;\n}');
    input.focus();
    const view = () => screen.getByTestId('code-view');
    const lines = () => [...view().querySelectorAll('.line-text')].map((l) => l.textContent);
    expect(lines()).toEqual(['int main() {', '    return 0;', '}']);
    await user.keyboard('int   main(){{');
    expect(lines()).toEqual(['int   main(){', '    return 0;', '}']);
    await user.keyboard(' return');
    expect(lines()).toEqual(['int   main(){ return 0;', '}']);
    await user.keyboard(' 0;{Enter}{Enter}');
    expect(lines()).toEqual(['int   main(){ return 0;', '\u200b', '}']);
    expect(view().querySelectorAll('.code-line')[2].querySelector('.caret')).toBeTruthy();
    await user.keyboard('{Backspace}{Backspace}');
    expect(lines()).toEqual(['int   main(){ return 0;', '}']);
  });

  it('las flechas, Inicio, Fin y Supr editan el código en vez de mover la página', async () => {
    const user = userEvent.setup({ delay: null });
    const { session, input } = setup('int x = 1;\nint y;');
    input.focus();
    await user.keyboard('int z = 2;{Enter}int y');
    await user.keyboard('{ArrowUp}{End}{ArrowLeft}{Backspace}1{Home}{Control>}{ArrowRight}{/Control}{ArrowRight}{Delete}x');
    expect(session.editor.text).toBe('int x = 1;\nint y');
    expect(session.snapshot().uncorrected).toBe(0);
    await user.keyboard('{Control>}{End}{/Control};');
    expect(session.snapshot().finishReason).toBe('completed');
  });

  it('Shift+flechas seleccionan y se dibuja la selección', async () => {
    const user = userEvent.setup({ delay: null });
    const { session, input } = setup('int value;');
    input.focus();
    await user.keyboard('int vlaue{Shift>}{Control>}{ArrowLeft}{/Control}{/Shift}');
    expect(session.editor.selection).toEqual([4, 9]);
    const selected = [...screen.getByTestId('code-view').querySelectorAll('.sel')].map((e) => e.textContent).join('');
    expect(selected).toHaveLength(5);
    await user.keyboard('value;');
    expect(session.snapshot().finishReason).toBe('completed');
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
  it('Enter solo no reinicia; Ctrl+Enter reinicia y Enter activa el botón enfocado', async () => {
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
    expect(onRestart).not.toHaveBeenCalled();
    await user.keyboard('{Control>}{Enter}{/Control}');
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

  it('la guía de dedos muestra la tecla y el dedo del siguiente carácter', async () => {
    const user = userEvent.setup({ delay: null });
    const { input } = setup('int x;', 'advance', () => {}, DEFAULT_LEARN);
    const target = () => [...document.querySelectorAll('.kb-key.target')].map((e) => e.getAttribute('data-code'));
    expect(target()).toEqual(['KeyI']);
    expect(screen.getByTestId('practice-guide').textContent).toContain('medio derecho');
    input.focus();
    await user.keyboard('int');
    expect(target()).toEqual(['Space']);
    expect(document.querySelector('.kb-hands .finger.on')?.getAttribute('data-finger')).toBe('r-thumb');
  });

  it('sin la opción no hay guía de dedos', () => {
    setup('int x;');
    expect(screen.queryByTestId('practice-guide')).toBeNull();
  });
});

