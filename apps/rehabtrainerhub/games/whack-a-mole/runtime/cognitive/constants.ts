// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "whack-a-mole", "titleKey": "cognitive.whack.title", "referenceTitleKey": "cognitive.whack.referenceTitle", "descriptionKey": "cognitive.whack.desc", "focusKey": "cognitive.whack.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
export const whackConfig: Record<Difficulty, {
    gridSize: number;
    targetMs: number;
    minDelay: number;
    maxDelay: number;
}> = {
    Beginner: { gridSize: 3, targetMs: 1100, minDelay: 0.35, maxDelay: 0.9 },
    Intermediate: { gridSize: 3, targetMs: 850, minDelay: 0.25, maxDelay: 0.72 },
    Advanced: { gridSize: 4, targetMs: 720, minDelay: 0.18, maxDelay: 0.58 },
};
