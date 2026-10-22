import { IsCorrect, SummarizeStopSignal, type StopSignalRow } from './logic/stopSignalScore';

const SideCode = (side: 'left' | 'right' | null) => side === null ? null : side === 'left' ? 0 : 1;

export function BuildGameScore(rows: StopSignalRow[], settings: { responseWindowMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), shape: row.shape, target: SideCode(row.target), response: SideCode(row.response),
    correct: Number(IsCorrect(row)), responseMs: row.rtMs, stop: Number(row.stop), stopDelayMs: row.stopDelayMs,
    condition: row.condition === null ? null : row.condition === 'high' ? 1 : 0, omission: Number(!row.stop && row.response === null), setting: settings.responseWindowMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'stop-signal', summary: { ...SummarizeStopSignal(rows) }, rounds };
}
