import { memo } from 'react';
import { t, type MessageKey } from '../../i18n';
import { FINGERS, handOf, keyLabel, type Board, type Finger, type KeyHighlight, type Layout, type PlacedKey, type Press } from '../../learn';
import { HOME_KEY } from './home';

const U = 40;
const GAP = 2;
const HOME_BUMPS = new Set(['KeyF', 'KeyJ']);

interface Props {
  board: Board;
  layout: Layout;
  fingers: ReadonlyMap<string, Finger>;
  highlight: KeyHighlight;
  /** Keys to press now. */
  targets?: readonly Press[];
  /** Error rate by key (0–1), drawn as a heat map instead of finger colors. */
  heat?: ReadonlyMap<string, number>;
  /** Draws the hands over the keys, each finger on its home key; `animated` moves a finger to its target. */
  hands?: { animated: boolean };
}

/** Space left under the board for the palms of the overlaid hands, in key units. */
const PALM_ROOM = 1.1;

/** Both hands resting on the home row, drawn over the board. */
function HandsOverlay({ board, targets, animated }: { board: Board; targets: readonly Press[]; animated: boolean }) {
  const at = (code: string) => board.keys.find((k) => k.code === code);
  const center = (k: PlacedKey) => ({ x: (k.x + k.w / 2) * U, y: (k.y + Math.min(k.h, 1) / 2) * U });
  const space = at('Space');
  const active = new Map<Finger, string>();
  for (const p of targets) if (p.finger) active.set(p.finger, p.code);
  const base = (board.height + PALM_ROOM - 0.25) * U;
  const tips = new Map<Finger, { x: number; y: number }>();
  for (const f of FINGERS) {
    const home = at(HOME_KEY[f]);
    if (!home) continue;
    if (!f.endsWith('thumb')) tips.set(f, center(home));
    // Thumbs rest on the space bar, each on its own side.
    else if (space) tips.set(f, { x: (space.x + space.w * (f === 'l-thumb' ? 0.3 : 0.7)) * U, y: (space.y + 0.5) * U });
  }
  const palm = (side: 'left' | 'right') => {
    const xs = FINGERS.filter((f) => handOf(f) === side && !f.endsWith('thumb')).map((f) => tips.get(f)?.x ?? 0);
    const from = Math.min(...xs) - 0.45 * U;
    const to = Math.max(...xs) + 0.45 * U;
    const top = (tips.get(side === 'left' ? 'l-index' : 'r-index')?.y ?? 0) + 1.7 * U;
    return <rect key={side} className="palm" x={from} y={top} width={to - from} height={base - top} rx={0.5 * U} />;
  };
  return (
    <g className={animated ? 'kb-hands animated' : 'kb-hands'} aria-hidden="true">
      {palm('left')}
      {palm('right')}
      {FINGERS.map((f) => {
        const tip = tips.get(f);
        if (!tip) return null;
        const code = active.get(f);
        const target = code && animated ? at(code) : undefined;
        const to = target && !f.endsWith('thumb') ? center(target) : tip;
        const thumb = f.endsWith('thumb');
        const w = 0.62 * U;
        const bottom = thumb ? tip.y + 1.1 * U : tip.y + 2.1 * U;
        return (
          <g key={f} className={code ? `finger on f-${f}` : 'finger'} data-finger={f} style={{ transform: `translate(${to.x - tip.x}px, ${to.y - tip.y}px)` }}>
            <rect x={tip.x - w / 2} y={tip.y - w / 2} width={w} height={bottom - tip.y + w / 2} rx={w / 2} transform={thumb ? `rotate(${f === 'l-thumb' ? 35 : -35} ${tip.x} ${tip.y})` : undefined} />
          </g>
        );
      })}
    </g>
  );
}

function special(code: string, layout: Layout): string {
  if (code === 'AltRight' && layout.altGr) return t('learn.specialKeys.AltGr');
  if (/^F\d+$/.test(code)) return code;
  if (/^Numpad\d$/.test(code)) return code.slice(-1);
  const text = t(`learn.specialKeys.${code}` as MessageKey);
  return text.startsWith('learn.') ? '' : text;
}

/** ISO Enter: wide on the upper row, narrower on the lower one. */
function isoEnterPath(k: PlacedKey): string {
  const x = k.x * U + GAP;
  const y = k.y * U + GAP;
  const w = k.w * U - 2 * GAP;
  const h = k.h * U - 2 * GAP;
  const notch = 0.25 * U;
  return `M${x} ${y}h${w}v${h}h${-(w - notch)}v${-(h / 2)}h${-notch}z`;
}

/** The user's keyboard, with the target key and the finger assignment. */
export const KeyboardView = memo(function KeyboardView({ board, layout, fingers, highlight, targets = [], heat, hands }: Props) {
  const targetCodes = new Set(targets.map((p) => p.code));
  return (
    <svg className="kb" viewBox={`0 0 ${board.width * U} ${(board.height + (hands ? PALM_ROOM : 0)) * U}`} role="img" aria-label={t('learn.keyboardLabel')}>
      {board.keys.map((k) => {
        const finger = fingers.get(k.code);
        const isTarget = highlight !== 'none' && targetCodes.has(k.code);
        const tinted = !heat && highlight === 'fingers' && finger;
        const cls = ['kb-key', finger && (tinted || isTarget) ? `f-${finger}` : '', tinted ? 'tinted' : '', isTarget ? 'target' : '', finger ? '' : 'unassigned'].filter(Boolean).join(' ');
        const rate = heat?.get(k.code);
        const style = rate ? { fill: `color-mix(in srgb, var(--bad) ${Math.round(Math.min(1, rate * 2.5) * 85)}%, var(--surface-2))` } : undefined;
        const label = keyLabel(layout, k.code) ?? special(k.code, layout);
        const small = label.length > 1;
        return (
          <g key={k.code} className={cls} data-code={k.code}>
            {k.isoEnter ? (
              <path d={isoEnterPath(k)} style={style} />
            ) : (
              <rect x={k.x * U + GAP} y={k.y * U + GAP} width={k.w * U - 2 * GAP} height={k.h * U - 2 * GAP} rx={5} style={style} />
            )}
            <text x={(k.x + k.w / 2) * U + (k.isoEnter ? 4 : 0)} y={(k.y + (k.isoEnter ? 0.5 : k.h / 2)) * U} className={small ? 'small' : undefined} dominantBaseline="central" textAnchor="middle">
              {label}
            </text>
            {HOME_BUMPS.has(k.code) && <line x1={(k.x + 0.35) * U} x2={(k.x + 0.65) * U} y1={(k.y + 0.82) * U} y2={(k.y + 0.82) * U} className="bump" />}
          </g>
        );
      })}
      {hands && <HandsOverlay board={board} targets={targets} animated={hands.animated} />}
    </svg>
  );
});
