// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "sliding-puzzle", "titleKey": "cognitive.sliding.title", "referenceTitleKey": "cognitive.sliding.referenceTitle", "descriptionKey": "cognitive.sliding.desc", "focusKey": "cognitive.sliding.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
export const slidingConfig: Record<Difficulty, {
    size: number;
    shuffles: number;
}> = {
    Beginner: { size: 3, shuffles: 36 },
    Intermediate: { size: 4, shuffles: 72 },
    Advanced: { size: 5, shuffles: 120 },
};
