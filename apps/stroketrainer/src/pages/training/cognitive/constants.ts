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
  {
    id: 'sudoku',
    titleKey: 'cognitive.sudoku.title',
    referenceTitleKey: 'cognitive.sudoku.referenceTitle',
    descriptionKey: 'cognitive.sudoku.desc',
    focusKey: 'cognitive.sudoku.focus',
  },
  {
    id: 'latin-square',
    titleKey: 'cognitive.latin.title',
    referenceTitleKey: 'cognitive.latin.referenceTitle',
    descriptionKey: 'cognitive.latin.desc',
    focusKey: 'cognitive.latin.focus',
  },
  {
    id: 'magic-square',
    titleKey: 'cognitive.magic.title',
    referenceTitleKey: 'cognitive.magic.referenceTitle',
    descriptionKey: 'cognitive.magic.desc',
    focusKey: 'cognitive.magic.focus',
  },
  {
    id: 'n-queens',
    titleKey: 'cognitive.queens.title',
    referenceTitleKey: 'cognitive.queens.referenceTitle',
    descriptionKey: 'cognitive.queens.desc',
    focusKey: 'cognitive.queens.focus',
  },
  {
    id: 'knights-tour',
    titleKey: 'cognitive.knights.title',
    referenceTitleKey: 'cognitive.knights.referenceTitle',
    descriptionKey: 'cognitive.knights.desc',
    focusKey: 'cognitive.knights.focus',
  },
  {
    id: 'binary-puzzle',
    titleKey: 'cognitive.binary.title',
    referenceTitleKey: 'cognitive.binary.referenceTitle',
    descriptionKey: 'cognitive.binary.desc',
    focusKey: 'cognitive.binary.focus',
  },
  {
    id: 'mastermind',
    titleKey: 'cognitive.mastermind.title',
    referenceTitleKey: 'cognitive.mastermind.referenceTitle',
    descriptionKey: 'cognitive.mastermind.desc',
    focusKey: 'cognitive.mastermind.focus',
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
    id: 'nim',
    titleKey: 'cognitive.nim.title',
    referenceTitleKey: 'cognitive.nim.referenceTitle',
    descriptionKey: 'cognitive.nim.desc',
    focusKey: 'cognitive.nim.focus',
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
    id: 'tangram',
    titleKey: 'cognitive.tangram.title',
    referenceTitleKey: 'cognitive.tangram.referenceTitle',
    descriptionKey: 'cognitive.tangram.desc',
    focusKey: 'cognitive.tangram.focus',
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
