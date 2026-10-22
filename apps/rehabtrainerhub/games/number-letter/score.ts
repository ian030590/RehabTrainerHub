import { IsCorrect, SummarizeNumberLetter, type NumberLetterRow } from './logic/numberLetterScore';

// Letter codes: 0 to 3 are the consonants G K M R, 4 to 7 the vowels A E I U.
const letterCodes = 'GKMRAEIU';

export function BuildGameScore(rows: NumberLetterRow[], settings: { responseWindowMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), condition: row.condition, top: Number(row.position.startsWith('top')),
    switched: row.switched === null ? null : Number(row.switched), letter: letterCodes.indexOf(row.letter), number: row.number,
    response: row.response === null ? null : row.response === 'z' ? 0 : 1, correct: Number(IsCorrect(row)), responseMs: row.rtMs, setting: settings.responseWindowMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'number-letter', summary: { ...SummarizeNumberLetter(rows) }, rounds };
}
