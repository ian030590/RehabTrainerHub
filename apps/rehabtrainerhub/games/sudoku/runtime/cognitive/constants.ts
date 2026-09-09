// Catalog-backed definitions for Hub-owned cognitive modules.
import type { TranslationKey } from '@rehab-trainer/ui/i18n';
import type { Difficulty,ReferenceModuleMeta } from './types';
export const referenceCognitiveModules: ReferenceModuleMeta[] = [{ "id": "sudoku", "titleKey": "cognitive.sudoku.title", "referenceTitleKey": "cognitive.sudoku.referenceTitle", "descriptionKey": "cognitive.sudoku.desc", "focusKey": "cognitive.sudoku.focus" }];
export const difficulties: Record<Difficulty, {
    labelKey: TranslationKey;
    descriptionKey: TranslationKey;
}> = {
    Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
    Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
    Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};
