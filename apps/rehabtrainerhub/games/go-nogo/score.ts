import { IsCorrect, SummarizeGoNoGo, type GoNoGoRow } from './logic/goNoGoScore';

export function BuildGameScore(rows: GoNoGoRow[], settings: { exposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), noGo: Number(row.noGo), color: row.color, responded: Number(row.responded),
    correct: Number(IsCorrect(row)), responseMs: row.rtMs, omission: Number(!row.noGo && !row.responded), commission: Number(row.noGo && row.responded),
    setting: settings.exposureMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'go-nogo', summary: { ...SummarizeGoNoGo(rows) }, rounds };
}
