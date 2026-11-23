import { t } from '../../i18n';
import { handOf, type Board, type Finger, type Press } from '../../learn';
import { HOME_KEY } from './home';

/** Finger shapes of the left hand: x, top, width and length; the right hand mirrors them. */
const SHAPES: Array<{ finger: string; x: number; y: number; w: number; h: number; rotate?: number }> = [
  { finger: 'pinky', x: 8, y: 34, w: 17, h: 50 },
  { finger: 'ring', x: 29, y: 16, w: 18, h: 66 },
  { finger: 'middle', x: 51, y: 8, w: 18, h: 74 },
  { finger: 'index', x: 73, y: 18, w: 18, h: 64 },
  { finger: 'thumb', x: 100, y: 66, w: 18, h: 44, rotate: 38 },
];

interface Props {
  /** Keys to press now, with their fingers. */
  targets: readonly Press[];
  board: Board;
  /** Moves the finger toward its key instead of only highlighting it. */
  animated: boolean;
}

/** How far a finger travels from its home key to the target, in drawing units. */
function reach(board: Board, finger: Finger, code: string): { dx: number; dy: number } {
  const at = (c: string) => board.keys.find((k) => k.code === c);
  const from = at(HOME_KEY[finger]);
  const to = at(code);
  if (!from || !to || finger.endsWith('thumb')) return { dx: 0, dy: 0 };
  const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  return { dx: clamp((to.x + to.w / 2 - (from.x + from.w / 2)) * 5, 14), dy: clamp((to.y - from.y) * 9, 20) };
}

/** Both hands seen from above, with the recommended fingers highlighted. */
export function HandsView({ targets, board, animated }: Props) {
  const active = new Map<Finger, string>();
  for (const p of targets) if (p.finger) active.set(p.finger, p.code);
  const names = [...active.keys()].map((f) => t(`learn.fingers.${f}`)).join(', ');

  const hand = (side: 'left' | 'right') => {
    const prefix = side === 'left' ? 'l' : 'r';
    return (
      <g transform={side === 'left' ? 'translate(8 0)' : 'translate(292 0) scale(-1 1)'} className={[...active.keys()].some((f) => handOf(f) === side) ? 'hand active' : 'hand'}>
        <rect className="palm" x={6} y={74} width={90} height={46} rx={18} />
        {SHAPES.map((s) => {
          const finger = `${prefix}-${s.finger}` as Finger;
          const code = active.get(finger);
          const { dx, dy } = code && animated ? reach(board, finger, code) : { dx: 0, dy: 0 };
          // The right hand is mirrored, so its horizontal travel is too.
          const style = { transform: `translate(${side === 'left' ? dx : -dx}px, ${dy}px)` };
          return (
            <g key={s.finger} className={code ? `finger on f-${finger}` : 'finger'} style={style} data-finger={finger}>
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.w / 2} transform={s.rotate ? `rotate(${s.rotate} ${s.x + s.w / 2} ${s.y + s.h})` : undefined} />
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg className={animated ? 'hands animated' : 'hands'} viewBox="0 0 300 124" role="img" aria-label={names ? t('learn.hands.label', { finger: names }) : t('learn.hands.idle')}>
      {hand('left')}
      {hand('right')}
    </svg>
  );
}
