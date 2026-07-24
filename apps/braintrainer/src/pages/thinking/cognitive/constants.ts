import { GetTrainingCatalogModules } from '@rehab-trainer/ui/trainingCatalog';
import type { TranslationKey } from '../../../i18n';
import type { Difficulty, ReferenceGameId, ReferenceModuleMeta, SessionLimitSeconds } from './types';

const referenceCatalogModules = GetTrainingCatalogModules({
  trainer: 'brain',
  kind: 'brain-reference',
});

export const referenceCognitiveModules: ReferenceModuleMeta[] = referenceCatalogModules.map((module) => ({
  id: module.runtimeId as ReferenceGameId,
  titleKey: module.titleKey as TranslationKey,
  referenceTitleKey: module.referenceTitleKey as TranslationKey,
  descriptionKey: module.descriptionKey as TranslationKey,
  focusKey: module.focusKey as TranslationKey,
}));

export type CognitiveTrainingArea = 'attention' | 'memory' | 'thinking';

export const cognitiveTrainingAreaTitleKeys: Record<CognitiveTrainingArea, TranslationKey> = {
  attention: 'module.attention.title',
  memory: 'module.memory.title',
  thinking: 'module.thinking.title',
};

export function GetCognitiveTrainingArea(gameId: ReferenceGameId): CognitiveTrainingArea {
  const purpose = referenceCatalogModules.find((module) => module.runtimeId === gameId)?.purpose;
  if (purpose === 'attention') return 'attention';
  if (purpose === 'memory') return 'memory';
  return 'thinking';
}

export function GetReferenceCognitiveModules(area: CognitiveTrainingArea) {
  return referenceCognitiveModules.filter((module) => GetCognitiveTrainingArea(module.id) === area);
}

export const difficulties: Record<Difficulty, { labelKey: TranslationKey; descriptionKey: TranslationKey }> = {
  Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
  Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
  Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};

export const sessionLimitOptions = [60, 120, 300, null] as const satisfies readonly SessionLimitSeconds[];
export const reactionTrialOptions = [5, 8, 12] as const;
export const whackDurationOptions = [30, 45, 60] as const;
export const cardValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const memoryConfig: Record<Difficulty, { rows: number; cols: number; pairs: number }> = {
  Beginner: { rows: 3, cols: 4, pairs: 6 },
  Intermediate: { rows: 4, cols: 4, pairs: 8 },
  Advanced: { rows: 4, cols: 5, pairs: 10 },
};

export const lightsConfig: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 8 },
  Intermediate: { size: 4, shuffles: 14 },
  Advanced: { size: 5, shuffles: 24 },
};

export const reactionConfig: Record<Difficulty, { minDelay: number; maxDelay: number }> = {
  Beginner: { minDelay: 1.4, maxDelay: 3.2 },
  Intermediate: { minDelay: 1.8, maxDelay: 4.4 },
  Advanced: { minDelay: 2.2, maxDelay: 5.2 },
};

export const whackConfig: Record<Difficulty, { gridSize: number; targetMs: number; minDelay: number; maxDelay: number }> = {
  Beginner: { gridSize: 3, targetMs: 1100, minDelay: 0.35, maxDelay: 0.9 },
  Intermediate: { gridSize: 3, targetMs: 850, minDelay: 0.25, maxDelay: 0.72 },
  Advanced: { gridSize: 4, targetMs: 720, minDelay: 0.18, maxDelay: 0.58 },
};

export const slidingConfig: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 36 },
  Intermediate: { size: 4, shuffles: 72 },
  Advanced: { size: 5, shuffles: 120 },
};
