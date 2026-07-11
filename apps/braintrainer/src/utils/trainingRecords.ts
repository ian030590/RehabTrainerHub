import type { TranslationKey } from '../i18n';

type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string;

export async function downloadAllTrainingRecordsCsv(_t: TFunction): Promise<boolean> {
  return false;
}
