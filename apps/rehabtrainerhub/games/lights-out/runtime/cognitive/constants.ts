// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "lights-out", "titleKey": "cognitive.lights.title", "referenceTitleKey": "cognitive.lights.referenceTitle", "descriptionKey": "cognitive.lights.desc", "focusKey": "cognitive.lights.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
export const lightsConfig: Record<Difficulty, {
    size: number;
    shuffles: number;
}> = {
    Beginner: { size: 3, shuffles: 8 },
    Intermediate: { size: 4, shuffles: 14 },
    Advanced: { size: 5, shuffles: 24 },
};
