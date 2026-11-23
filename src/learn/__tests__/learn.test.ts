import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  buildCurriculum,
  charMap,
  DEFAULT_LEARN,
  detectLayout,
  emptyProgress,
  Exercise,
  fingerMap,
  fingerStats,
  generateExercise,
  hardestChars,
  LAYOUT_IDS,
  LAYOUTS,
  learnedChars,
  levelOf,
  LEVELS,
  parseProgress,
  pressesFor,
  recordRun,
  sanitizeLearn,
  SIZE_IDS,
  weakness,
  type CharStat,
  type LayoutId,
} from '..';
import { rng as mulberry32 } from '../../lib/random';

const setup = (layout: LayoutId, size = 'tkl' as (typeof SIZE_IDS)[number], geometry = LAYOUTS[layout].geometry) => {
  const board = buildBoard(size, geometry);
  const map = charMap(LAYOUTS[layout], new Set(board.keys.map((k) => k.code)));
  return { board, map, lessons: buildCurriculum(LAYOUTS[layout], map), fingers: fingerMap(layout, geometry, { spaceThumb: 'right' }) };
};

describe('distribuciones y tamaños', () => {
  it.each(SIZE_IDS.flatMap((s) => (['ansi', 'iso', 'hybrid'] as const).map((g) => [s, g] as const)))('%s %s: teclas únicas, sin solaparse y con las letras', (size, geometry) => {
    const { keys, width, height } = buildBoard(size, geometry);
    expect(new Set(keys.map((k) => k.code)).size).toBe(keys.length);
    for (const k of keys) expect(k.x + k.w).toBeLessThanOrEqual(width + 1e-9);
    expect(height).toBeGreaterThan(4);
    const cells = keys.filter((k) => !k.isoEnter);
    for (const a of cells) {
      for (const b of cells) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9;
        expect(overlap, `${a.code} / ${b.code}`).toBe(false);
      }
    }
    for (const code of ['KeyQ', 'KeyA', 'KeyZ', 'KeyM', 'Semicolon', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight', 'Backspace', 'Tab']) expect(keys.some((k) => k.code === code), code).toBe(true);
    expect(keys.some((k) => k.code === 'IntlBackslash')).toBe(geometry !== 'ansi');
    expect(keys.find((k) => k.code === 'Enter')!.isoEnter ?? false).toBe(geometry === 'iso');
    expect(keys.find((k) => k.code === 'Backslash')!.y).toBe(keys.find((k) => k.code === (geometry === 'iso' ? 'KeyA' : 'KeyQ'))!.y);
  });

  it('cada tamaño tiene los bloques que le corresponden', () => {
    const has = (size: (typeof SIZE_IDS)[number], code: string) => buildBoard(size, 'ansi').keys.some((k) => k.code === code);
    expect([has('full', 'Numpad5'), has('tkl', 'Numpad5')]).toEqual([true, false]);
    expect([has('tkl', 'F5'), has('75', 'F5'), has('65', 'F5'), has('60', 'F5'), has('laptop', 'F5')]).toEqual([true, true, false, false, true]);
    expect([has('65', 'ArrowUp'), has('60', 'ArrowUp')]).toEqual([true, false]);
    expect([has('60', 'Backquote'), has('75', 'Backquote')]).toEqual([false, true]);
  });

  it('las distribuciones difieren en símbolos, ñ y acentos', () => {
    expect(setup('es-latam').map.get('ñ')).toEqual([{ code: 'Semicolon' }]);
    expect(setup('en-us').map.get(';')).toEqual([{ code: 'Semicolon' }]);
    expect(setup('en-us').map.has('ñ')).toBe(false);
    expect(setup('es-latam').map.get('á')).toEqual([{ code: 'BracketLeft' }, { code: 'KeyA' }]);
    expect(setup('es-es').map.get('á')).toEqual([{ code: 'Quote' }, { code: 'KeyA' }]);
    expect(setup('es-es').map.get('ü')).toEqual([{ code: 'Quote', shift: true }, { code: 'KeyU' }]);
    expect(setup('es-latam').map.get('@')).toEqual([{ code: 'KeyQ', altgr: true }]);
    expect(setup('en-uk').map.get('"')).toEqual([{ code: 'Digit2', shift: true }]);
    expect(setup('en-us').map.get('"')).toEqual([{ code: 'Quote', shift: true }]);
    expect(setup('en-uk').map.get('#')).toEqual([{ code: 'Backslash' }]);
    expect(setup('es-latam').map.get('-')).toEqual([{ code: 'Slash' }]);
  });

  it('un carácter cuya tecla no existe en el teclado no se puede escribir', () => {
    expect(setup('es-latam', 'tkl').map.has('|')).toBe(true);
    // En 60 % la esquina es Esc y no hay tecla para «|».
    expect(setup('es-latam', '60').map.has('|')).toBe(false);
    expect(setup('es-latam', 'tkl', 'ansi').map.has('<')).toBe(false);
  });
});

describe('dedos', () => {
  it.each(LAYOUT_IDS)('%s: asignación estándar por columnas', (layout) => {
    const { fingers } = setup(layout);
    const expectAll = (finger: string, codes: string) => {
      for (const c of codes.split(' ')) expect(fingers.get(c), c).toBe(finger);
    };
    expectAll('l-pinky', 'Digit1 KeyQ KeyA KeyZ');
    expectAll('l-ring', 'Digit2 KeyW KeyS KeyX');
    expectAll('l-middle', 'Digit3 KeyE KeyD KeyC');
    expectAll('l-index', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB');
    expectAll('r-index', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM');
    expectAll('r-middle', 'Digit8 KeyI KeyK Comma');
    expectAll('r-ring', 'Digit9 KeyO KeyL Period');
    expectAll('r-pinky', 'Digit0 KeyP Semicolon Slash');
    expect(fingers.get('F5')).toBeUndefined();
  });

  it('la forma y las preferencias cambian la asignación', () => {
    expect(fingerMap('en-us', 'ansi', { spaceThumb: 'right' }).has('IntlBackslash')).toBe(false);
    expect(fingerMap('es-latam', 'iso', { spaceThumb: 'right' }).get('IntlBackslash')).toBe('l-pinky');
    expect(fingerMap('es-latam', 'hybrid', { spaceThumb: 'right' }).get('IntlBackslash')).toBe('l-pinky');
    expect(setup('es-latam', 'tkl', 'hybrid').map.get('<')).toEqual([{ code: 'IntlBackslash' }]);
    expect(setup('es-latam', 'tkl', 'hybrid').map.get('}')).toEqual([{ code: 'Backslash' }]);
    expect(fingerMap('es-latam', 'iso', { spaceThumb: 'left' }).get('Space')).toBe('l-thumb');
  });

  it('las mayúsculas usan el Shift de la mano contraria', () => {
    const { fingers } = setup('en-us');
    expect(pressesFor({ code: 'KeyA', shift: true }, fingers)).toEqual([{ code: 'ShiftRight', finger: 'r-pinky' }, { code: 'KeyA', finger: 'l-pinky' }]);
    expect(pressesFor({ code: 'KeyJ', shift: true }, fingers)[0]).toEqual({ code: 'ShiftLeft', finger: 'l-pinky' });
    expect(pressesFor({ code: 'KeyQ', altgr: true }, fingers)[0]).toEqual({ code: 'AltRight', finger: 'r-thumb' });
  });
});

describe('lecciones', () => {
  it('se adaptan a la distribución', () => {
    const es = setup('es-latam').lessons;
    const en = setup('en-us').lessons;
    expect(es.find((l) => l.id === 'home-a')!.chars).toEqual(['a', 'ñ']);
    expect(en.find((l) => l.id === 'home-a')!.chars).toEqual(['a', ';']);
    expect(es.some((l) => l.id === 'full-accents')).toBe(true);
    expect(en.some((l) => l.id === 'full-accents')).toBe(false);
    expect(es.find((l) => l.id === 'full-punctuation')!.chars).toContain('¿');
    expect(en.find((l) => l.id === 'full-punctuation')!.chars).not.toContain('¿');
    expect(new Set(es.map((l) => l.stage))).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8]));
  });

  it('lo aprendido se acumula en orden', () => {
    const { lessons } = setup('es-latam');
    expect(learnedChars(lessons, 'home-fj').sort()).toEqual([' ', 'f', 'j']);
    expect(learnedChars(lessons, 'home-sl').sort()).toEqual([' ', 'd', 'f', 'j', 'k', 'l', 's']);
  });
});

describe('generador de ejercicios', () => {
  it.each(LAYOUT_IDS)('%s: cada lección de teclas usa solo lo aprendido e incluye las teclas nuevas', (layout) => {
    const { lessons, map } = setup(layout);
    for (const lesson of lessons.filter((l) => l.kind !== 'sentences' && l.kind !== 'timed')) {
      const learned = learnedChars(lessons, lesson.id);
      const text = generateExercise({ lesson, learned, language: LAYOUTS[layout].language, rand: mulberry32(7), canType: (c) => map.has(c) });
      expect(text.length, lesson.id).toBeGreaterThan(20);
      expect([...text].filter((ch) => !learned.includes(ch)), lesson.id).toEqual([]);
      for (const ch of lesson.chars.slice(0, 2)) expect(text, lesson.id).toContain(ch);
      expect(text).not.toMatch(/ {2}|^ | $/);
    }
  });

  it.each(LAYOUT_IDS)('%s: las frases solo usan caracteres que el teclado puede escribir', (layout) => {
    const { lessons, map } = setup(layout, '60');
    for (const lesson of lessons.filter((l) => l.kind === 'sentences' || l.kind === 'timed')) {
      const text = generateExercise({ lesson, learned: learnedChars(lessons, lesson.id), language: LAYOUTS[layout].language, rand: mulberry32(3), canType: (c) => map.has(c) });
      expect(text.length).toBeGreaterThan(40);
      expect([...text].filter((ch) => !map.has(ch))).toEqual([]);
    }
  });

  it('las teclas que fallan aparecen más', () => {
    const { lessons } = setup('en-us');
    const lesson = lessons.find((l) => l.id === 'home-all')!;
    const learned = learnedChars(lessons, lesson.id);
    const count = (stats?: Map<string, CharStat>) => {
      let n = 0;
      for (let seed = 1; seed <= 30; seed++) n += [...generateExercise({ lesson, learned, language: 'en', stats, rand: mulberry32(seed) })].filter((c) => c === 'k').length;
      return n;
    };
    const weak = new Map<string, CharStat>(learned.map((c) => [c, { attempts: 20, errors: c === 'k' ? 12 : 0, ms: 4000 }]));
    expect(count(weak)).toBeGreaterThan(count() * 1.5);
    expect(weakness('k', weak)).toBeGreaterThan(weakness('a', weak));
    expect(weakness('k', undefined)).toBe(1);
  });

  it('se alarga cuando la lección va bien y se acorta cuando cuesta', () => {
    const { lessons } = setup('en-us');
    const lesson = lessons.find((l) => l.id === 'home-fj')!;
    const len = (bestAccuracy?: number) => generateExercise({ lesson, learned: learnedChars(lessons, lesson.id), language: 'en', bestAccuracy, rand: mulberry32(1) }).split(' ').length;
    expect(len(0.99)).toBeGreaterThan(len());
    expect(len(0.7)).toBeLessThan(len());
  });
});

describe('ejercicio', () => {
  it('una tecla incorrecta no avanza y cuenta como error', () => {
    const e = new Exercise('fj f');
    expect(e.press('f', 1000)).toBe(true);
    expect(e.press('x', 1200)).toBe(false);
    expect(e.lastWrong).toBe('x');
    expect(e.pos).toBe(1);
    expect(e.press('j', 1500)).toBe(true);
    e.press(' ', 1700);
    e.press('f', 2000);
    expect(e.finished).toBe(true);
    expect(e.results[1]).toEqual({ ch: 'j', errors: 1, ms: 500 });
    const s = e.summary(9999);
    expect(s).toMatchObject({ chars: 4, errors: 1, accuracy: 0.8, ms: 1000, completed: true });
    expect(s.wpm).toBeCloseTo(48);
    expect(e.press('f', 3000)).toBe(false);
  });

  it('un ejercicio por tiempo termina al agotarse', () => {
    const e = new Exercise('abcdef', 1000);
    expect(e.tick(5000)).toBe(false);
    e.press('a', 0);
    e.press('b', 500);
    expect(e.remaining(600)).toBe(400);
    expect(e.press('c', 1200)).toBe(false);
    expect(e.finished).toBe(true);
    expect(e.summary(5000)).toMatchObject({ chars: 2, ms: 1000, completed: true });
  });
});

describe('detección', () => {
  const sample = (layout: LayoutId, code: string) => {
    const k = LAYOUTS[layout].keys[code];
    return { code, key: k.deadBase ? 'Dead' : k.base! };
  };
  it.each(LAYOUT_IDS)('%s: se reconoce a sí misma', (layout) => {
    const iso = LAYOUTS[layout].geometry === 'iso';
    const d = detectLayout([sample(layout, iso ? 'IntlBackslash' : 'KeyZ'), sample(layout, 'Equal'), sample(layout, 'Backslash')], 'en-us');
    expect(d).toEqual({ layout, geometry: LAYOUTS[layout].geometry, uncertain: false, reason: undefined });
  });

  it('avisa cuando no está segura', () => {
    expect(detectLayout([null, null, null], 'es-es')).toMatchObject({ layout: 'es-es', uncertain: true, reason: 'noCodes' });
    expect(detectLayout([{ code: '', key: 'z' }, { code: '', key: '=' }, null], 'es-es')).toMatchObject({ uncertain: true, reason: 'noCodes' });
    expect(detectLayout([{ code: 'KeyP', key: 'p' }, sample('en-us', 'Equal'), sample('en-us', 'Backslash')], 'es-es')).toMatchObject({ uncertain: true, reason: 'unexpectedKey' });
    expect(detectLayout([sample('en-us', 'KeyZ'), null, null], 'es-es')).toMatchObject({ geometry: 'ansi', uncertain: true, reason: 'ambiguous' });
    // Distribución de EE. UU. en un teclado ISO: la forma se toma de la tecla presionada.
    expect(detectLayout([{ code: 'IntlBackslash', key: '\\' }, sample('en-us', 'Equal'), sample('en-us', 'Backslash')], 'es-es')).toMatchObject({ layout: 'en-us', geometry: 'iso' });
  });
});

describe('progreso', () => {
  it('acumula por carácter, tecla, dedo y lección', () => {
    const { map, fingers } = setup('es-latam');
    const e = new Exercise('fñf');
    e.press('f', 0);
    e.press('x', 100);
    e.press('ñ', 400);
    e.press('f', 700);
    let p = recordRun(emptyProgress(), 'home-fj', e.results, e.summary(700), map, 1);
    expect(p.chars['ñ']).toEqual({ attempts: 2, errors: 1, ms: 400 });
    expect(p.keys.Semicolon).toEqual({ attempts: 2, errors: 1, ms: 400 });
    expect(p.keys.KeyF).toEqual({ attempts: 2, errors: 0, ms: 300 });
    expect(p.lessons['home-fj']).toMatchObject({ runs: 1, passed: false, bestAccuracy: 0.75 });
    const good = new Exercise('fj');
    good.press('f', 0);
    good.press('j', 200);
    p = recordRun(p, 'home-fj', good.results, good.summary(200), map, 2);
    expect(p.lessons['home-fj']).toMatchObject({ runs: 2, passed: true, bestAccuracy: 1 });
    expect(p.runs).toHaveLength(2);
    expect(fingerStats(p, fingers).find((f) => f.finger === 'r-pinky')).toMatchObject({ attempts: 2, errors: 1, accuracy: 0.5 });
    expect(hardestChars(p, 2)[0]).toMatchObject({ ch: 'ñ', rate: 0.5 });
    expect(parseProgress(JSON.stringify(p))).toEqual(p);
  });

  it('ignora datos guardados corruptos', () => {
    expect(parseProgress('{no es json')).toEqual(emptyProgress());
    expect(parseProgress(JSON.stringify({ chars: { a: { attempts: 'x' }, b: { attempts: 1, errors: 0, ms: 5 } }, lessons: { z: {} }, runs: [{}, null] }))).toEqual({
      chars: { b: { attempts: 1, errors: 0, ms: 5 } },
      keys: {},
      lessons: {},
      runs: [],
    });
  });
});

describe('ajustes', () => {
  it('los niveles fijan la guía y los valores inválidos vuelven al predeterminado', () => {
    expect(levelOf(DEFAULT_LEARN)).toBe('beginner');
    expect(levelOf({ ...DEFAULT_LEARN, ...LEVELS.advanced })).toBe('advanced');
    expect(levelOf({ ...DEFAULT_LEARN, hands: 'none' })).toBe('custom');
    expect(sanitizeLearn({ ...DEFAULT_LEARN, layout: 'xx' as LayoutId, size: '65' })).toEqual({ ...DEFAULT_LEARN, size: '65' });
  });
});
