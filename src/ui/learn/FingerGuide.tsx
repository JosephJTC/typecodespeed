import type { LearnSettings, Stroke } from '../../learn';
import { guidePresses } from './guide';
import { HandsView } from './HandsView';
import { KeyboardView } from './KeyboardView';
import type { Keyboard } from './useKeyboard';

interface Props {
  keyboard: Keyboard;
  settings: LearnSettings;
  /** The key press to guide, or none while there is nothing to type. */
  stroke?: Stroke;
}

/** Keyboard and hands for the next key, laid out as the user prefers. */
export function FingerGuide({ keyboard, settings, stroke }: Props) {
  const presses = guidePresses(keyboard, stroke);
  const hands = settings.hands === 'none' ? undefined : settings.handsPosition;
  const animated = settings.hands === 'animated';
  return (
    <div className={`guide hands-${hands ?? 'none'}`}>
      <KeyboardView
        board={keyboard.board}
        layout={keyboard.layout}
        fingers={keyboard.fingers}
        highlight={settings.keyHighlight}
        targets={presses}
        hands={hands === 'overlay' ? { animated } : undefined}
      />
      {hands && hands !== 'overlay' && <HandsView targets={presses} board={keyboard.board} animated={animated} />}
    </div>
  );
}
