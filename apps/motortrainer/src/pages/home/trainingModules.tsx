import type { TranslationKey } from '../../i18n';

export type TrainingModuleId = 'upper-limb-training' | 'lower-limb-training';

export interface TrainingModuleCardData {
  id: TrainingModuleId;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

export const trainingModules: readonly TrainingModuleCardData[] = [
  {
    id: 'upper-limb-training',
    titleKey: 'home.module.upperLimb.title',
    descKey: 'home.module.upperLimb.desc',
  },
  {
    id: 'lower-limb-training',
    titleKey: 'home.module.lowerLimb.title',
    descKey: 'home.module.lowerLimb.desc',
  },
];
