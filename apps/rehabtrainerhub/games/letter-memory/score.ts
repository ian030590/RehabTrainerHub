import { SummarizeLetterMemory, type LetterMemoryRow } from './logic/letterMemoryScore';

export function BuildGameScore(rows: LetterMemoryRow[], settings: { itemExposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), correct: Number(row.correctItems === row.requiredItems), responseMs: row.rtMs,
    setting: settings.itemExposureMs, load: row.length, correctItems: row.correctItems, requiredItems: row.requiredItems }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'letter-memory', summary: { ...SummarizeLetterMemory(rows) }, rounds };
}
