import { memo } from 'react';
import { t, type MessageKey } from '../../i18n';
import { keyLabel, type Board, type Finger, type KeyHighlight, type Layout, type PlacedKey, type Press } from '../../learn';

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
export const KeyboardView = memo(function KeyboardView({ board, layout, fingers, highlight, targets = [], heat }: Props) {
  const targetCodes = new Set(targets.map((p) => p.code));
  return (
    <svg className="kb" viewBox={`0 0 ${board.width * U} ${board.height * U}`} role="img" aria-label={t('learn.keyboardLabel')}>
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
    </svg>
  );
});
