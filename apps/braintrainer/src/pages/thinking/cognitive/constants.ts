import type { TranslationKey } from '../../../i18n';
import type { Difficulty, ReferenceGameId, ReferenceModuleMeta, SessionLimitSeconds } from './types';

export const referenceCognitiveModules: ReferenceModuleMeta[] = [
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
  {
    id: 'sudoku',
    titleKey: 'cognitive.sudoku.title',
    referenceTitleKey: 'cognitive.sudoku.referenceTitle',
    descriptionKey: 'cognitive.sudoku.desc',
    focusKey: 'cognitive.sudoku.focus',
  },
  {
    id: 'bulls-and-cows',
    titleKey: 'cognitive.bulls.title',
    referenceTitleKey: 'cognitive.bulls.referenceTitle',
    descriptionKey: 'cognitive.bulls.desc',
    focusKey: 'cognitive.bulls.focus',
  },
  {
    id: 'simon-says',
    titleKey: 'cognitive.simon.title',
    referenceTitleKey: 'cognitive.simon.referenceTitle',
    descriptionKey: 'cognitive.simon.desc',
    focusKey: 'cognitive.simon.focus',
  },
  {
    id: 'tic-tac-toe',
    titleKey: 'cognitive.tictactoe.title',
    referenceTitleKey: 'cognitive.tictactoe.referenceTitle',
    descriptionKey: 'cognitive.tictactoe.desc',
    focusKey: 'cognitive.tictactoe.focus',
  },
  {
    id: 'connect4',
    titleKey: 'cognitive.connect4.title',
    referenceTitleKey: 'cognitive.connect4.referenceTitle',
    descriptionKey: 'cognitive.connect4.desc',
    focusKey: 'cognitive.connect4.focus',
  },
  {
    id: 'dots-and-boxes',
    titleKey: 'cognitive.dots.title',
    referenceTitleKey: 'cognitive.dots.referenceTitle',
    descriptionKey: 'cognitive.dots.desc',
    focusKey: 'cognitive.dots.focus',
  },
  {
    id: 'hex',
    titleKey: 'cognitive.hex.title',
    referenceTitleKey: 'cognitive.hex.referenceTitle',
    descriptionKey: 'cognitive.hex.desc',
    focusKey: 'cognitive.hex.focus',
  },
  {
    id: 'set-game',
    titleKey: 'cognitive.set.title',
    referenceTitleKey: 'cognitive.set.referenceTitle',
    descriptionKey: 'cognitive.set.desc',
    focusKey: 'cognitive.set.focus',
  },
  {
    id: 'sokoban',
    titleKey: 'cognitive.sokoban.title',
    referenceTitleKey: 'cognitive.sokoban.referenceTitle',
    descriptionKey: 'cognitive.sokoban.desc',
    focusKey: 'cognitive.sokoban.focus',
  },
  {
    id: 'maze',
    titleKey: 'cognitive.maze.title',
    referenceTitleKey: 'cognitive.maze.referenceTitle',
    descriptionKey: 'cognitive.maze.desc',
    focusKey: 'cognitive.maze.focus',
  },
];

export type CognitiveTrainingArea = 'attention' | 'memory' | 'thinking';

export const cognitiveTrainingAreaTitleKeys: Record<CognitiveTrainingArea, TranslationKey> = {
  attention: 'module.attention.title',
  memory: 'module.memory.title',
  thinking: 'module.thinking.title',
};

const attentionCognitiveGameIds = new Set<ReferenceGameId>(['reaction-time', 'whack-a-mole']);
const memoryCognitiveGameIds = new Set<ReferenceGameId>(['memory-match', 'simon-says']);

export function GetCognitiveTrainingArea(gameId: ReferenceGameId): CognitiveTrainingArea {
  if (attentionCognitiveGameIds.has(gameId)) return 'attention';
  if (memoryCognitiveGameIds.has(gameId)) return 'memory';
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
