import type { TranslationKey } from '../../../i18n';
import type { Difficulty, ReferenceModuleMeta, SessionLimitSeconds } from './types';

export const REFERENCE_COGNITIVE_MODULES: ReferenceModuleMeta[] = [
  {
    id: 'memory-match',
    titleKey: 'cognitive.memory.title',
    referenceTitleKey: 'cognitive.memory.referenceTitle',
    descriptionKey: 'cognitive.memory.desc',
    focusKey: 'cognitive.memory.focus',
  },
  {
    id: 'lights-out',
    titleKey: 'cognitive.lights.title',
    referenceTitleKey: 'cognitive.lights.referenceTitle',
    descriptionKey: 'cognitive.lights.desc',
    focusKey: 'cognitive.lights.focus',
  },
  {
    id: 'reaction-time',
    titleKey: 'cognitive.reaction.title',
    referenceTitleKey: 'cognitive.reaction.referenceTitle',
    descriptionKey: 'cognitive.reaction.desc',
    focusKey: 'cognitive.reaction.focus',
  },
  {
    id: 'whack-a-mole',
    titleKey: 'cognitive.whack.title',
    referenceTitleKey: 'cognitive.whack.referenceTitle',
    descriptionKey: 'cognitive.whack.desc',
    focusKey: 'cognitive.whack.focus',
  },
  {
    id: 'sliding-puzzle',
    titleKey: 'cognitive.sliding.title',
    referenceTitleKey: 'cognitive.sliding.referenceTitle',
    descriptionKey: 'cognitive.sliding.desc',
    focusKey: 'cognitive.sliding.focus',
  },
];

export const DIFFICULTIES: Record<Difficulty, { labelKey: TranslationKey; descriptionKey: TranslationKey }> = {
  Beginner: { labelKey: 'cognitive.diff.beginner', descriptionKey: 'cognitive.diff.beginnerDesc' },
  Intermediate: { labelKey: 'cognitive.diff.intermediate', descriptionKey: 'cognitive.diff.intermediateDesc' },
  Advanced: { labelKey: 'cognitive.diff.advanced', descriptionKey: 'cognitive.diff.advancedDesc' },
};

export const SESSION_LIMIT_OPTIONS = [60, 120, 300, null] as const satisfies readonly SessionLimitSeconds[];
export const REACTION_TRIAL_OPTIONS = [5, 8, 12] as const;
export const WHACK_DURATION_OPTIONS = [30, 45, 60] as const;
export const CARD_VALUES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export const MEMORY_CONFIG: Record<Difficulty, { rows: number; cols: number; pairs: number }> = {
  Beginner: { rows: 3, cols: 4, pairs: 6 },
  Intermediate: { rows: 4, cols: 4, pairs: 8 },
  Advanced: { rows: 4, cols: 5, pairs: 10 },
};

export const LIGHTS_CONFIG: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 8 },
  Intermediate: { size: 4, shuffles: 14 },
  Advanced: { size: 5, shuffles: 24 },
};

export const REACTION_CONFIG: Record<Difficulty, { minDelay: number; maxDelay: number }> = {
  Beginner: { minDelay: 1.4, maxDelay: 3.2 },
  Intermediate: { minDelay: 1.8, maxDelay: 4.4 },
  Advanced: { minDelay: 2.2, maxDelay: 5.2 },
};

export const WHACK_CONFIG: Record<Difficulty, { gridSize: number; targetMs: number; minDelay: number; maxDelay: number }> = {
  Beginner: { gridSize: 3, targetMs: 1100, minDelay: 0.35, maxDelay: 0.9 },
  Intermediate: { gridSize: 3, targetMs: 850, minDelay: 0.25, maxDelay: 0.72 },
  Advanced: { gridSize: 4, targetMs: 720, minDelay: 0.18, maxDelay: 0.58 },
};

export const SLIDING_CONFIG: Record<Difficulty, { size: number; shuffles: number }> = {
  Beginner: { size: 3, shuffles: 36 },
  Intermediate: { size: 4, shuffles: 72 },
  Advanced: { size: 5, shuffles: 120 },
};
