import { SummarizeAntisaccade, type AntisaccadeRow } from './logic/antisaccadeScore';

export function BuildGameScore(rows: AntisaccadeRow[], settings: { exposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), location: row.side, arrow: row.arrow, response: row.response,
    correct: Number(row.correct), omission: Number(row.response === null), responseMs: row.rtMs, setting: settings.exposureMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'antisaccade', summary: { ...SummarizeAntisaccade(rows) }, rounds };
}
