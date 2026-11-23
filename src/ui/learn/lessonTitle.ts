import { t, type MessageKey } from '../../i18n';
import type { Lesson } from '../../learn';

export function lessonTitle(l: Lesson): string {
  if (l.positional) return t('learn.lessonKeys', { keys: l.chars.map((c) => c.toUpperCase()).join(' ') });
  return t(`learn.lessonNames.${l.id}` as MessageKey);
}
