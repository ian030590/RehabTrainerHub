import * as TrainingContracts from '@rehab-trainer/training-contracts';
import type { TrainingRunResult } from '@rehab-trainer/training-contracts';

type RunResultValidator = (value: unknown) => value is TrainingRunResult;

/**
 * Validate persisted run envelopes through the contracts package. The
 * fallback keeps an already-installed pCloud copy of the workspace package
 * readable until the next frozen install refreshes its generated copy.
 */
export function ToTrainingRunResult(value: unknown): TrainingRunResult | undefined {
  const validator = (TrainingContracts as unknown as {
    IsTrainingRunResult?: RunResultValidator;
  }).IsTrainingRunResult;
  if (validator) return validator(value) ? value : undefined;
  return IsLegacyRunResult(value) ? value : undefined;
}

function IsLegacyRunResult(value: unknown): value is TrainingRunResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return item.schemaVersion === 1
    && typeof item.moduleId === 'string'
    && /^[a-z]+:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.moduleId)
    && typeof item.moduleVersion === 'string'
    && item.moduleVersion.trim().length > 0
    && (item.status === 'completed' || item.status === 'aborted')
    && typeof item.startedAt === 'string'
    && !Number.isNaN(Date.parse(item.startedAt))
    && Number.isInteger(item.durationMs)
    && (item.durationMs as number) >= 0
    && Number.isInteger(item.trialCount)
    && (item.trialCount as number) >= 0
    && IsSafeMetricRecord(item.metrics)
    && (item.score === undefined || (typeof item.score === 'number' && Number.isFinite(item.score)));
}

function IsSafeMetricRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > 128) return false;
  return entries.every(([key, metric]) => (
    /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key)
    && !/auth|email|jwt|name|password|token|user/i.test(key)
    && ((typeof metric === 'number' && Number.isFinite(metric))
      || typeof metric === 'boolean'
      || metric === null)
  ));
}
