import type { TranslationKey } from '../../i18n';

export type TrainingModuleId =
  | 'moving-card'
  | 'oculomotor-training'
  | 'gabor-patching'
  | 'reading-training'
  | 'driving-rehab'
  | 'hart-chart';

export interface TrainingModuleDefinition {
  id: TrainingModuleId;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}

export const TRAINING_MODULES: readonly TrainingModuleDefinition[] = [
  {
    id: 'moving-card',
    titleKey: 'home.module.movingCard.title',
    descKey: 'home.module.movingCard.desc',
  },
  {
    id: 'oculomotor-training',
    titleKey: 'home.module.oculomotor.title',
    descKey: 'home.module.oculomotor.desc',
  },
  {
    id: 'gabor-patching',
    titleKey: 'home.module.gaborPatching.title',
    descKey: 'home.module.gaborPatching.desc',
  },
  {
    id: 'reading-training',
    titleKey: 'home.module.reading.title',
    descKey: 'home.module.reading.desc',
  },
  {
    id: 'driving-rehab',
    titleKey: 'home.module.driving.title',
    descKey: 'home.module.driving.desc',
  },
  {
    id: 'hart-chart',
    titleKey: 'home.module.hartChart.title',
    descKey: 'home.module.hartChart.desc',
  },
];
