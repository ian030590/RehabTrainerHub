import { IsCorrect, SummarizeSpatialSpan, type SpatialSpanRow } from './logic/spatialSpanScore';

export function BuildGameScore(rows: SpatialSpanRow[], settings: { itemExposureMs: number; boardSize: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), reverse: Number(row.reverse), load: row.load, entered: row.response.length,
    correct: Number(IsCorrect(row)), responseMs: row.rtMs, setting: settings.itemExposureMs, board: settings.boardSize }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'spatial-span', summary: { ...SummarizeSpatialSpan(rows) }, rounds };
}
