// Types local to the Hub-owned mouth modules.
import type { TranslationKey } from '../../i18n';

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
