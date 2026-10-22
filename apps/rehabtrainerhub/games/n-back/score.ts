import { IsCorrect, SummarizeNBack, type NBackRow } from './logic/nBackScore';

// Letter codes follow the original stimulus list.
const letters = 'bBdDgGtTvV';

export function BuildGameScore(rows: NBackRow[], settings: { exposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), load: row.load, letter: letters.indexOf(row.letter), match: Number(row.match),
    response: row.response === null ? null : row.response === 'same' ? 0 : 1, correct: Number(IsCorrect(row)), responseMs: row.rtMs, setting: settings.exposureMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'n-back', summary: { ...SummarizeNBack(rows) }, rounds };
}
