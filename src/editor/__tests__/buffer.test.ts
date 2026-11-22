import { describe, expect, it } from 'vitest';
import { EditorBuffer } from '../buffer';

function buf(text: string, cursor = text.length) {
  const b = new EditorBuffer();
  b.insert(text);
  b.setCursor(cursor);
  b.takeDirty();
  return b;
}

describe('EditorBuffer', () => {
  it('inserta en el cursor y registra desde dónde cambió', () => {
    const b = buf('int x;', 4);
    b.insert('y');
    expect(b.text).toBe('int yx;');
    expect(b.cursor).toBe(5);
    expect(b.takeDirty()).toBe(4);
    expect(b.takeDirty()).toBe(Infinity);
  });

  it('insertAt no mueve un cursor anterior', () => {
    const b = buf('f(', 2);
    b.insertAt(2, ')', 'ahead');
    expect(b.text).toBe('f()');
    expect(b.cursor).toBe(2);
    expect(b.cells[2].auto).toBe(true);
  });

  it('izquierda, derecha y límites', () => {
    const b = buf('ab', 0);
    b.move('left');
    expect(b.cursor).toBe(0);
    b.move('right');
    b.move('right');
    b.move('right');
    expect(b.cursor).toBe(2);
  });

  it('arriba y abajo conservan la columna deseada', () => {
    const b = buf('abcd\nx\nabcdef', 13);
    b.move('up');
    expect(b.cursor).toBe(6);
    b.move('up');
    expect(b.cursor).toBe(4);
    b.move('down');
    expect(b.cursor).toBe(6);
    b.move('down');
    expect(b.cursor).toBe(13);
  });

  it('arriba en la primera línea va al inicio y abajo en la última al final', () => {
    const b = buf('ab\ncd', 1);
    b.move('up');
    expect(b.cursor).toBe(0);
    b.setCursor(4);
    b.move('down');
    expect(b.cursor).toBe(5);
  });

  it('Inicio va al primer carácter no blanco y luego a la columna 0; Fin al final de la línea', () => {
    const b = buf('x\n    y = 1;\nz', 12);
    b.move('home');
    expect(b.cursor).toBe(6);
    b.move('home');
    expect(b.cursor).toBe(2);
    b.move('end');
    expect(b.cursor).toBe(12);
    b.move('docStart');
    expect(b.cursor).toBe(0);
    b.move('docEnd');
    expect(b.cursor).toBe(14);
  });

  it('Ctrl+flechas saltan palabras y grupos de símbolos', () => {
    const b = buf('int value += 10;', 0);
    const stops: number[] = [];
    for (let i = 0; i < 5; i++) {
      b.move('wordRight');
      stops.push(b.cursor);
    }
    expect(stops).toEqual([3, 9, 12, 15, 16]);
    b.move('wordLeft');
    expect(b.cursor).toBe(15);
    b.move('wordLeft');
    expect(b.cursor).toBe(13);
    b.move('wordLeft');
    expect(b.cursor).toBe(10);
  });

  it('Ctrl+flechas se detienen en los saltos de línea', () => {
    const b = buf('a\n  b', 5);
    b.move('wordLeft');
    expect(b.cursor).toBe(4);
    b.move('wordLeft');
    expect(b.cursor).toBe(2);
    b.move('wordLeft');
    expect(b.cursor).toBe(1);
    b.move('wordRight');
    expect(b.cursor).toBe(2);
  });

  it('Shift extiende la selección y escribir la reemplaza', () => {
    const b = buf('int abc;', 7);
    b.move('wordLeft', true);
    expect(b.selection).toEqual([4, 7]);
    b.insert('x');
    expect(b.text).toBe('int x;');
    expect(b.hasSelection).toBe(false);
  });

  it('izquierda o derecha sin Shift colapsan la selección', () => {
    const b = buf('abcd', 1);
    b.setCursor(3, true);
    b.move('left');
    expect(b.cursor).toBe(1);
    b.setCursor(3, true);
    b.move('right');
    expect(b.cursor).toBe(3);
  });

  it('borrar ajusta cursor y selección', () => {
    const b = buf('abcdef', 5);
    b.delete(1, 3);
    expect(b.text).toBe('adef');
    expect(b.cursor).toBe(3);
    b.selectAll();
    b.deleteSelection();
    expect(b.text).toBe('');
  });

  it('save y restore', () => {
    const b = buf('ab', 1);
    const saved = b.save();
    b.insert('zz');
    b.restore(saved);
    expect(b.text).toBe('ab');
    expect(b.cursor).toBe(1);
  });
});
