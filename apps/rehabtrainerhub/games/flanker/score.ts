import { SummarizeFlanker, type FlankerRow } from './logic/flankerScore';

export function BuildGameScore(rows: FlankerRow[], settings: { responseWindowMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), condition: Number(!row.congruent), target: row.target,
    response: row.response, correct: Number(row.correct), responseMs: row.rtMs, setting: settings.responseWindowMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'flanker', summary: { ...SummarizeFlanker(rows) }, rounds };
}
