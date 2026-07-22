import type { TranslationKey } from '../../i18n';

export type TrainingModuleId = 'motor-training';

export interface TrainingModuleCardData {
  id: TrainingModuleId;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

export const trainingModules: readonly TrainingModuleCardData[] = [
  {
    id: 'motor-training',
    titleKey: 'home.module.motor.title',
    descKey: 'home.module.motor.desc',
  },
];
