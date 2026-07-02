import type { TranslationKey } from '../../i18n';
import { getActiveUser } from '../../utils/settings';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export function hasSelectedTrainingUser(): boolean {
  return Boolean(getActiveUser());
}

export function verifySelectedTrainingUser(t: TFunction): boolean {
  if (hasSelectedTrainingUser()) return true;

  window.alert(t('home.pleaseSelectUser'));
  return false;
}
