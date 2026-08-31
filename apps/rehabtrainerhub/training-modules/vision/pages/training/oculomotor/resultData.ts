import type { TrialData } from '../types';

export const oculomotorTrialType = 'pixi-oculomotor-training';

export function FindOculomotorResult(
  results: readonly TrialData[],
): TrialData | undefined {
  return results.find((result) => result.trial_type === oculomotorTrialType)
    ?? results.find((result) => (
      typeof result.mode === 'string'
      && (result.duration_ms !== undefined || result.acquired_targets !== undefined)
    ));
}
