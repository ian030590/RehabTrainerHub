import { SummarizePlusMinus, type PlusMinusRow } from './logic/plusMinusScore';

export function BuildGameScore(rows: PlusMinusRow[], settings: { itemsPerList: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, question: row.question, practice: Number(row.practice), setting: settings.itemsPerList, condition: row.condition,
    correct: Number(row.correct), responseMs: row.rtMs, number: row.number, response: row.response }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'plus-minus', summary: { ...SummarizePlusMinus(rows) }, rounds };
}
