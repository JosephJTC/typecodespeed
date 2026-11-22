// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from '../../../App';
import { MemoryLibraryStore } from '../../../library';
import { MemoryHistoryStore } from '../../../stats';
import { DEFAULT_SETTINGS, metaFor, parseSettings, resolveSource, textsFor } from '../../practice/config';
import { setHistoryStore } from '../../stats/history';
import { setLibraryStore } from '../useLibrary';

const file = (path: string, text: string) => {
  const f = new File([text], path.slice(path.lastIndexOf('/') + 1));
  Object.defineProperty(f, 'webkitRelativePath', { value: path });
  return f;
};

const BFS = 'int main() {\n  return 0;\n}\n';
const FILES = [
  file('referencias/Grafos/bfs.cpp', BFS),
  file('referencias/Grafos/dijkstra.cpp', 'int d;\n'),
  file('referencias/Estructuras/dsu.py', 'x = 1\n'),
  file('referencias/Grafos/diagrama.png', 'binario'),
];

let history: MemoryHistoryStore;
beforeEach(() => {
  localStorage.clear();
  history = new MemoryHistoryStore();
  setHistoryStore(history);
  setLibraryStore(new MemoryLibraryStore());
});
afterEach(cleanup);

const flush = () => act(async () => {});

async function importFolder(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await flush();
  await user.click(screen.getByRole('button', { name: 'Referencias' }));
  await flush();
  fireEvent.change(screen.getAllByLabelText('Elegir carpeta…', { selector: 'input' })[0], { target: { files: FILES } });
  await screen.findByText('3 archivos', { exact: false });
}

describe('explorador de referencias', () => {
  it('importa una carpeta, muestra el árbol y omite lo que no es código', async () => {
    const user = userEvent.setup();
    await importFolder(user);
    expect(screen.getByText('referencias')).toBeTruthy();
    expect(screen.getByText(/1 archivo omitido/)).toBeTruthy();
    const list = within(screen.getByTestId('explorer-list'));
    expect(list.getByText('Grafos')).toBeTruthy();
    expect(list.getByText('Estructuras')).toBeTruthy();
    expect(list.getByText('bfs.cpp')).toBeTruthy();
    expect(list.queryByText('diagrama.png')).toBeNull();
  });

  it('busca y filtra por lenguaje', async () => {
    const user = userEvent.setup();
    await importFolder(user);
    await user.type(screen.getByLabelText('Buscar'), 'dij');
    const list = within(screen.getByTestId('explorer-list'));
    expect(list.getByText('Grafos/dijkstra.cpp')).toBeTruthy();
    expect(list.queryByText('Grafos/bfs.cpp')).toBeNull();
    await user.clear(screen.getByLabelText('Buscar'));
    fireEvent.change(screen.getByLabelText('Lenguaje'), { target: { value: 'Python' } });
    expect(list.getByText('Estructuras/dsu.py')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Practicar una al azar (1)' })).toBeTruthy();
  });

  it('selecciona un archivo, lo practica completo y guarda el resultado con su ruta', async () => {
    const user = userEvent.setup({ delay: null });
    await importFolder(user);
    await user.click(screen.getByRole('button', { name: 'bfs.cpp' }));
    expect(screen.getByText(/C\+\+ · 3 líneas/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Practicar completa' }));
    expect((screen.getByLabelText('Código') as HTMLSelectElement).value).toBe('ref');
    expect(screen.getByText('Referencia: Grafos/bfs.cpp')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    screen.getByRole('textbox').focus();
    await user.keyboard('int main(){{return 0;}');
    await flush();
    const saved = await history.list();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ sourceId: 'ref:Grafos/bfs.cpp', sourceName: 'Grafos/bfs.cpp', language: 'cpp', completion: 1, testType: 'full' });
    // Recently practiced references appear in the explorer.
    await user.click(screen.getByRole('button', { name: 'Referencias' }));
    await flush();
    expect(screen.getByText('Practicadas recientemente')).toBeTruthy();
  });

  it('quita las referencias del navegador', async () => {
    const user = userEvent.setup();
    await importFolder(user);
    window.confirm = () => true;
    await user.click(screen.getByRole('button', { name: 'Quitar referencias' }));
    expect(screen.getByText(/Elige tu carpeta de referencias/)).toBeTruthy();
  });

  it('avisa cuando no hay código compatible', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flush();
    await user.click(screen.getByRole('button', { name: 'Referencias' }));
    await flush();
    fireEvent.change(screen.getByLabelText('Elegir archivos…', { selector: 'input' }), { target: { files: [file('foto.png', 'x')] } });
    expect(await screen.findByText(/No se encontraron archivos de código compatibles/)).toBeTruthy();
  });
});

describe('otro fragmento', () => {
  it('no repite el fragmento visible aunque se omitan los comentarios', async () => {
    const user = userEvent.setup({ delay: null });
    render(<App />);
    await flush();
    await user.click(screen.getByRole('button', { name: 'Referencias' }));
    await flush();
    const code = 'void a() {\n  // uno\n  x();\n}\n\nvoid b() {\n  // dos\n  y();\n}\n';
    fireEvent.change(screen.getByLabelText('Elegir archivos…', { selector: 'input' }), { target: { files: [file('dos.cpp', code)] } });
    await user.click(await screen.findByRole('button', { name: 'dos.cpp' }));
    await user.click(screen.getByRole('button', { name: 'Fragmento aleatorio' }));
    await user.click(screen.getByRole('button', { name: 'Comenzar' }));
    const visible = () => (screen.getByTestId('code-view').textContent!.includes('x()') ? 'a' : 'b');
    for (let i = 0; i < 25; i++) {
      const before = visible();
      await user.click(screen.getByRole('button', { name: /Otro fragmento/ }));
      expect(visible()).not.toBe(before);
    }
  });
});

describe('ajustes', () => {
  it('se guardan y se restauran al volver a abrir la aplicación', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await flush();
    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    fireEvent.change(screen.getByLabelText('Tamaño del código'), { target: { value: '19' } });
    fireEvent.change(screen.getByLabelText('Al equivocarte'), { target: { value: 'block' } });
    first.unmount();
    render(<App />);
    await flush();
    await user.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect((screen.getByLabelText('Tamaño del código') as HTMLSelectElement).value).toBe('19');
    expect((screen.getByLabelText('Al equivocarte') as HTMLSelectElement).value).toBe('block');
  });

  it('ignora ajustes guardados corruptos o de otro tipo', () => {
    expect(parseSettings('no es json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    const s = parseSettings(JSON.stringify({ fontSize: 'grande', durationSec: 30, desconocido: 1, custom: { indentation: 'exact' } }));
    expect(s.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(s.durationSec).toBe(30);
    expect(s).not.toHaveProperty('desconocido');
    expect(s.custom).toEqual({ ...DEFAULT_SETTINGS.custom, indentation: 'exact' });
  });
});

describe('origen del código', () => {
  const names = { all: 'Todos', custom: 'Propio' };
  const ref = (path: string, text: string, language = 'cpp') =>
    ({ path, name: path, dir: '', ext: 'cpp', language, languageName: 'C++', text, lines: text.split('\n').length, chars: text.length });
  const files = [ref('a.cpp', 'int a;\n'), ref('b.cpp', 'int b;\n'), ref('c.py', 'c = 1\n', 'plaintext')];

  it('resuelve la referencia seleccionada con su lenguaje', () => {
    const s = { ...DEFAULT_SETTINGS, source: 'ref', refPath: 'c.py' };
    const src = resolveSource(s, files, names)!;
    expect(src).toMatchObject({ id: 'ref:c.py', name: 'c.py', language: 'plaintext', codes: ['c = 1\n'] });
    expect(metaFor(s, src)).toMatchObject({ sourceId: 'ref:c.py', language: 'plaintext', testType: 'full' });
    expect(textsFor(s, src).first).toBe('c = 1\n');
    expect(resolveSource({ ...s, refPath: 'no-existe.cpp' }, files, names)).toBeNull();
  });

  it('la referencia al azar respeta los filtros y no repite la anterior', () => {
    const s = { ...DEFAULT_SETTINGS, source: 'refRandom', refQuery: { text: 'cpp' } };
    for (let i = 0; i < 30; i++) {
      const src = resolveSource(s, files, names, Math.random, 'ref:a.cpp')!;
      expect(src.id).toBe('ref:b.cpp');
    }
    expect(resolveSource({ ...s, refQuery: { text: 'zzz' } }, files, names)).toBeNull();
    expect(resolveSource(s, [], names)).toBeNull();
  });

  it('ejemplos y código propio', () => {
    expect(resolveSource({ ...DEFAULT_SETTINGS, source: 'custom', customCode: '  ' }, files, names)).toBeNull();
    expect(resolveSource({ ...DEFAULT_SETTINGS, source: 'custom', customCode: 'int x;' }, files, names)).toMatchObject({ id: 'custom', name: 'Propio' });
    expect(resolveSource({ ...DEFAULT_SETTINGS, source: 'all' }, files, names)!.codes.length).toBeGreaterThan(1);
    expect(resolveSource(DEFAULT_SETTINGS, files, names)!.codes).toHaveLength(1);
  });
});
