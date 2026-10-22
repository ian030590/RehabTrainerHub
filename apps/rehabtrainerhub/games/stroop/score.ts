import { SummarizeStroop, type StroopRow } from './logic/stroopScore';

export function BuildGameScore(rows: StroopRow[], settings: { responseWindowMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), condition: Number(!row.congruent), word: row.word, color: row.ink,
    response: row.response, correct: Number(row.correct), responseMs: row.rtMs, setting: settings.responseWindowMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'stroop', summary: { ...SummarizeStroop(rows) }, rounds };
}
