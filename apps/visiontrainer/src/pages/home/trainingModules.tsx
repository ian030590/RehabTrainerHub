import {
  GetTrainingCatalogModules,
  type TrainingCatalogModule,
} from '@rehab-trainer/ui/trainingCatalog';

export type TrainingModuleId =
  | 'moving-card'
  | 'oculomotor-training'
  | 'gabor-patching'
  | 'reading-training'
  | 'driving-rehab'
  | 'hart-chart';

export interface TrainingModuleDefinition {
  id: TrainingModuleId;
  catalogModule: TrainingCatalogModule;
}

export const trainingModules: readonly TrainingModuleDefinition[] =
  GetTrainingCatalogModules({ trainer: 'vision', purpose: 'vision', kind: 'vision' })
    .map((catalogModule) => ({
      id: catalogModule.runtimeId as TrainingModuleId,
      catalogModule,
    }));
