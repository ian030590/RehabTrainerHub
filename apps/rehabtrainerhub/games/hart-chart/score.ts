export interface HartResult {
  completedAt: string;
  durationMs: number;
  attempts: number;
  targetCount: number;
  accuracy: number;
  phrase: string;
  hintsUsed: boolean;
}
export function BuildGameScore(result: Pick<HartResult, 'durationMs' | 'attempts' | 'targetCount' | 'accuracy' | 'hintsUsed'> | null) {
  const summary = { durationMs: result?.durationMs ?? null, targets: result?.targetCount ?? null,
    attempts: result?.attempts ?? null, accuracy: result?.accuracy ?? null, hints: result ? Number(result.hintsUsed) : null };
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'hart-chart', summary, rounds: result ? [{ ...summary }] : [] };
}
