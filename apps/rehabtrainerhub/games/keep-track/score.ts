import { SummarizeKeepTrack, type KeepTrackRow } from './logic/keepTrackScore';

export function BuildGameScore(rows: KeepTrackRow[], settings: { itemExposureMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), correct: Number(row.correctItems === row.requiredItems), responseMs: row.rtMs,
    setting: settings.itemExposureMs, load: row.load, correctItems: row.correctItems, requiredItems: row.requiredItems }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'keep-track', summary: { ...SummarizeKeepTrack(rows) }, rounds };
}
