// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "reaction-time", "titleKey": "cognitive.reaction.title", "referenceTitleKey": "cognitive.reaction.referenceTitle", "descriptionKey": "cognitive.reaction.desc", "focusKey": "cognitive.reaction.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
export const reactionConfig: Record<Difficulty, {
    minDelay: number;
    maxDelay: number;
}> = {
    Beginner: { minDelay: 1.4, maxDelay: 3.2 },
    Intermediate: { minDelay: 1.8, maxDelay: 4.4 },
    Advanced: { minDelay: 2.2, maxDelay: 5.2 },
};
