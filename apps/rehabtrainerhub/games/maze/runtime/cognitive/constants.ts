// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "maze", "titleKey": "cognitive.maze.title", "referenceTitleKey": "cognitive.maze.referenceTitle", "descriptionKey": "cognitive.maze.desc", "focusKey": "cognitive.maze.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
