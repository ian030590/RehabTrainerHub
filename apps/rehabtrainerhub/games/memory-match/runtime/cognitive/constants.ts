// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "memory-match", "titleKey": "cognitive.memory.title", "referenceTitleKey": "cognitive.memory.referenceTitle", "descriptionKey": "cognitive.memory.desc", "focusKey": "cognitive.memory.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
export const cardValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const memoryConfig: Record<Difficulty, {
    rows: number;
    cols: number;
    pairs: number;
}> = {
    Beginner: { rows: 3, cols: 4, pairs: 6 },
    Intermediate: { rows: 4, cols: 4, pairs: 8 },
    Advanced: { rows: 4, cols: 5, pairs: 10 },
};
