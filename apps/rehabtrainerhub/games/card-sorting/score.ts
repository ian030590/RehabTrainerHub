import { SummarizeSorting, type SortRow } from './logic/cardSorting';
import type { SortingSettings } from './settings';

export function BuildGameScore(rows: SortRow[], settings: SortingSettings) {
  const rounds = rows.map(row => ({ trial: row.trial, rule: row.rule, cardColor: row.cardColor, cardShape: row.cardShape, cardCount: row.cardCount,
    chosen: row.chosen, correct: Number(row.correct), perseverative: Number(row.perseverative), category: row.category, rtMs: row.rtMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'card-sorting', summary: { ...SummarizeSorting(rows, settings) }, rounds };
}
