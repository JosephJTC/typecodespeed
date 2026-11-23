import { useMemo } from 'react';
import { buildBoard, buildCurriculum, charMap, fingerMap, LAYOUTS, type LearnSettings } from '../../learn';

/** Everything derived from the keyboard configuration: board, typeable characters, fingers and lessons. */
export function useKeyboard(s: LearnSettings) {
  return useMemo(() => {
    const layout = LAYOUTS[s.layout];
    const board = buildBoard(s.size, s.geometry);
    const map = charMap(layout, new Set(board.keys.map((k) => k.code)));
    const fingers = fingerMap(s.layout, s.geometry, { spaceThumb: s.spaceThumb });
    return { layout, board, map, fingers, lessons: buildCurriculum(layout, map) };
  }, [s.layout, s.size, s.geometry, s.spaceThumb]);
}

export type Keyboard = ReturnType<typeof useKeyboard>;
