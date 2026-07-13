import type { TranslationKey } from '../../i18n';
import type { TestType } from './logic/optotypeRenderer';

export interface AssessmentDefinition {
  id: TestType;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  optionCount: number;
  defaultTrialCount: number;
}

export const ASSESSMENTS: readonly AssessmentDefinition[] = [
  {
    id: 'landolt',
    titleKey: 'assess.landolt.title',
    descriptionKey: 'assess.landolt.desc',
    optionCount: 8,
    defaultTrialCount: 18,
  },
  {
    id: 'tumblingE',
    titleKey: 'assess.tumblingE.title',
    descriptionKey: 'assess.tumblingE.desc',
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'letters',
    titleKey: 'assess.sloan.title',
    descriptionKey: 'assess.sloan.desc',
    optionCount: 10,
    defaultTrialCount: 18,
  },
  {
    id: 'pictures',
    titleKey: 'assess.shapes.title',
    descriptionKey: 'assess.shapes.desc',
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'gratings',
    titleKey: 'assess.pl.title',
    descriptionKey: 'assess.pl.desc',
    optionCount: 2,
    defaultTrialCount: 36,
  },
  {
    id: 'contrast',
    titleKey: 'assess.contrast.title',
    descriptionKey: 'assess.contrast.desc',
    optionCount: 8,
    defaultTrialCount: 18,
  },
];
