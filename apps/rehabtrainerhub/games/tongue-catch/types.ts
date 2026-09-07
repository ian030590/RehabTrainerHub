// Types local to the Hub-owned mouth modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n/games';

export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;
