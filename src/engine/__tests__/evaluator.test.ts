import { describe, expect, it } from 'vitest';
import { buildTarget, evaluate, Evaluator } from '..';
import type { CompareOptions } from '../types';
import { CORPUS } from './fixtures';
import { rng } from './random';

const MODES: CompareOptions[] = [
  { mode: 'tolerant', comments: 'omit' },
  { mode: 'tolerant', comments: 'include' },
  { mode: 'exact', comments: 'include' },
  { mode: 'custom', comments: 'omit', custom: { indentation: 'ignore', inlineSpaces: 'collapse', lineBreaks: 'exact', blankLines: 'ignore' } },
];

describe('Evaluator incremental', () => {
  it('push/pop (retroceso) produce el mismo estado que evaluar desde cero', () => {
    const rand = rng(1234);
    const alphabet = 'intx;(){}<>= +-*/&|\n\t ab01"\'';
    for (const [name, src] of Object.entries(CORPUS)) {
      for (const opts of MODES) {
        const target = buildTarget(src, 'cpp', opts);
        const ev = new Evaluator(target);
        let typed = '';
        for (let step = 0; step < 400; step++) {
          const r = rand();
          if (r < 0.2 && typed.length > 0) {
            ev.pop();
            typed = typed.slice(0, -1);
          } else {
            // Mostly type the right character, sometimes a random one.
            const next = r < 0.85 ? (target.items[ev.pos]?.kind === 'char' ? (target.items[ev.pos] as { ch: string }).ch : ' ') : alphabet[Math.floor(rand() * alphabet.length)];
            ev.push(next);
            typed += next;
          }
        }
        const fresh = evaluate(target, typed);
        expect(ev.states, `${name}/${opts.mode}`).toEqual(fresh.states);
        expect(ev.extras).toEqual(fresh.extras);
        expect(ev.pos).toBe(fresh.pos);
        expect(ev.getCounts()).toEqual(fresh.counts);
      }
    }
  });

  it('peek no modifica el estado', () => {
    const ev = new Evaluator(buildTarget('int x;'));
    ev.push('i');
    const before = JSON.stringify([ev.states, ev.extras, ev.pos]);
    expect(ev.peek('q').status).toBe('error');
    expect(ev.peek('n').status).toBe('correct');
    expect(JSON.stringify([ev.states, ev.extras, ev.pos])).toBe(before);
  });

  it('política "bloquear": solo se aceptan pulsaciones correctas', () => {
    const target = buildTarget('int x = 5;');
    const ev = new Evaluator(target);
    let rejected = 0;
    for (const ch of 'inntx x = 55;') {
      if (ev.peek(ch).status === 'error') rejected++;
      else ev.push(ch);
    }
    // La 'n' repetida, la 'x' sin espacio previo y el '5' repetido se rechazan.
    expect(rejected).toBe(3);
    expect(ev.complete).toBe(true);
  });

  it('los espacios libres no cuentan como caracteres a escribir', () => {
    const target = buildTarget('if (x) {\n    y();\n}');
    expect(target.charCount).toBe('if(x){y();}'.length);
    const ev = evaluate(target, 'if (x) {\n    y();\n}');
    expect(ev.results.filter((r) => r.status === 'free').length).toBe(8);
    expect(ev.counts.correct).toBe(target.charCount);
  });

  it('el texto vacío produce un objetivo vacío completo', () => {
    const target = buildTarget('   \n\n  ');
    expect(target.items).toEqual([]);
    expect(evaluate(target, '').complete).toBe(true);
  });
});
