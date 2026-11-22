import { describe, expect, it } from 'vitest';
import { buildTarget, evaluate } from '../../engine';
import { rng } from '../../lib/random';
import { dedent, extractBlocks, pickSnippet } from '../extract';
import { SAMPLES } from '../samples';

const SRC = `#include <bits/stdc++.h>
using namespace std;

struct P {
    int x, y;
    int norm() const {
        return x * x + y * y;
    }
};

int main() {
    for (int i = 0; i < 3; i++) {
        cout << i;
    }
}`;

describe('extracción de fragmentos', () => {
  const blocks = extractBlocks(SRC);
  const texts = blocks.map((b) => b.text);

  it('encuentra structs, funciones y ciclos con su declaración', () => {
    expect(texts).toContain('struct P {\n    int x, y;\n    int norm() const {\n        return x * x + y * y;\n    }\n};');
    expect(texts).toContain('int norm() const {\n    return x * x + y * y;\n}');
    expect(texts).toContain('for (int i = 0; i < 3; i++) {\n    cout << i;\n}');
    expect(texts.some((t) => t.startsWith('int main() {'))).toBe(true);
  });

  it('no incluye directivas de preprocesador ni declaraciones previas', () => {
    for (const t of texts) {
      expect(t).not.toContain('#include');
      expect(t).not.toContain('using namespace');
    }
  });

  it('los bloques anidados quedan sin indentación común', () => {
    const inner = blocks.find((b) => b.text.startsWith('for'))!;
    expect(inner.depth).toBe(1);
    expect(dedent('    a\n      b\n\n    c')).toBe('a\n  b\n\nc');
  });

  it('cada fragmento de los ejemplos se puede completar sin errores', () => {
    for (const sample of SAMPLES) {
      for (const b of extractBlocks(sample.code)) {
        const target = buildTarget(b.text, 'cpp', { mode: 'exact', comments: 'include' });
        const ev = evaluate(target, target.text);
        expect(ev.complete && ev.errors === 0, `${sample.id}: ${b.text.slice(0, 40)}`).toBe(true);
      }
    }
  });

  it('pickSnippet respeta el rango de líneas y es determinista con la misma semilla', () => {
    const sources = SAMPLES.map((s) => s.code);
    const a = Array.from({ length: 20 }, (_, i) => pickSnippet(sources, rng(i), { minLines: 4, maxLines: 12 }));
    const b = Array.from({ length: 20 }, (_, i) => pickSnippet(sources, rng(i), { minLines: 4, maxLines: 12 }));
    expect(a).toEqual(b);
    for (const s of a) {
      const n = s.split('\n').length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(12);
    }
    expect(new Set(a).size).toBeGreaterThan(3);
  });

  it('sin bloques adecuados usa una ventana de líneas', () => {
    const src = Array.from({ length: 50 }, (_, i) => `int a${i} = ${i};`).join('\n');
    const s = pickSnippet([src], rng(1), { minLines: 3, maxLines: 10 });
    expect(s.split('\n').length).toBe(10);
  });

  it('fuentes vacías devuelven texto vacío', () => {
    expect(pickSnippet(['', '   '], rng(1))).toBe('');
  });
});
