export interface GaborPatchRecord {
  patch: number;
  type: number;
  outcome: number;
  spawnedMs: number;
  endedMs: number;
  reactionMs: number | null;
  points: number;
  lifetimeMs: number;
}
export interface GaborTrial {
  trial_type?: string;
  score?: number;
  acquired_targets?: number;
  duration_ms?: number;
  patchRecords?: GaborPatchRecord[];
}

export function BuildGameScore(results: GaborTrial[]) {
  const trial = results.find(row => row.trial_type === 'pixi-gabor-patching');
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'gabor-patching',
    summary: { score: trial?.score ?? null, hits: trial?.acquired_targets ?? null, durationMs: trial?.duration_ms ?? null },
    rounds: (trial?.patchRecords ?? []).map(row => ({ ...row })) };
}
