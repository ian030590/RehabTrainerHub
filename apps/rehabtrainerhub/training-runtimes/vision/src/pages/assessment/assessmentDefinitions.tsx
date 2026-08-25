import type { TranslationKey } from '../../i18n';
import type { TestType } from './logic/optotypeRenderer';

export type AssessmentId = TestType | 'ufov';

export interface AssessmentDefinition {
  id: AssessmentId;
  imagePath: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  optionCount?: number;
  defaultTrialCount?: number;
}

export const assessments: readonly AssessmentDefinition[] = [
  {
    id: 'landolt',
    imagePath: '/assets/training-modules/assessment-landolt.webp',
    titleKey: 'assess.landolt.title',
    descriptionKey: 'assess.landolt.desc',
    optionCount: 8,
    defaultTrialCount: 18,
  },
  {
    id: 'tumblingE',
    imagePath: '/assets/training-modules/assessment-tumbling-e.webp',
    titleKey: 'assess.tumblingE.title',
    descriptionKey: 'assess.tumblingE.desc',
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'letters',
    imagePath: '/assets/training-modules/assessment-letters.webp',
    titleKey: 'assess.sloan.title',
    descriptionKey: 'assess.sloan.desc',
    optionCount: 10,
    defaultTrialCount: 18,
  },
  {
    id: 'pictures',
    imagePath: '/assets/training-modules/assessment-pictures.webp',
    titleKey: 'assess.shapes.title',
    descriptionKey: 'assess.shapes.desc',
    optionCount: 4,
    defaultTrialCount: 24,
  },
  {
    id: 'gratings',
    imagePath: '/assets/training-modules/assessment-gratings.webp',
    titleKey: 'assess.pl.title',
    descriptionKey: 'assess.pl.desc',
    optionCount: 2,
    defaultTrialCount: 36,
  },
  {
    id: 'contrast',
    imagePath: '/assets/training-modules/assessment-contrast.webp',
    titleKey: 'assess.contrast.title',
    descriptionKey: 'assess.contrast.desc',
    optionCount: 8,
    defaultTrialCount: 18,
  },
  {
    id: 'ufov',
    imagePath: '/assets/training-modules/assessment-peripheral-attention.webp',
    titleKey: 'assess.ufov.title',
    descriptionKey: 'assess.ufov.desc',
  },
];
