export interface ExpFactorySummary {
  totalTrials: number;
  scoredTrials: number;
  correctTrials: number;
  accuracyPercent: number | null;
  meanRtMs: number | null;
}

export function GetExpFactoryRoundLimit(settings: Record<string, unknown> | null): number | null {
  const rounds = settings?.rounds;
  if (rounds === undefined) return null;
  if (!Number.isInteger(rounds) || (rounds as number) <= 0 || (rounds as number) > 10_000) {
    throw new Error('Invalid rounds setting.');
  }
  return rounds as number;
}

export function HasReachedExpFactoryRoundLimit(limit: number | null, completedRounds: number): boolean {
  return limit !== null && completedRounds >= limit;
}

export function SummarizeExpFactoryTrials(rows: Record<string, unknown>[]): ExpFactorySummary {
  const testRows = rows.filter((row) => row.exp_stage === 'test'
    && (row.trial_id === 'stim' || row.trial_id === 'response' || row.trial_id === 'to_board'));
  const taskRows = testRows.length > 0 ? testRows : rows.filter((row) => (
    row.trial_id === 'stim' || row.trial_id === 'response' || row.trial_id === 'to_board'
  ));
  const scoredRows = taskRows.filter((row) => IsCorrectValue(row.correct) !== null);
  const correctTrials = scoredRows.filter((row) => IsCorrectValue(row.correct) === true).length;
  const responseTimes = taskRows.map((row) => row.rt)
    .filter((rt): rt is number => typeof rt === 'number' && Number.isFinite(rt) && rt >= 0);
  return {
    totalTrials: taskRows.length,
    scoredTrials: scoredRows.length,
    correctTrials,
    accuracyPercent: scoredRows.length > 0 ? correctTrials / scoredRows.length * 100 : null,
    meanRtMs: responseTimes.length > 0
      ? responseTimes.reduce((total, rt) => total + rt, 0) / responseTimes.length
      : null,
  };
}

function IsCorrectValue(value: unknown): boolean | null {
  if (value === true || value === 1 || value === 'true') return true;
  if (value === false || value === 0 || value === 'false') return false;
  return null;
}
