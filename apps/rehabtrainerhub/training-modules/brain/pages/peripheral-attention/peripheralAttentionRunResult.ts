import {
  CreateTrainingModuleId,
  CreateTrainingRunResult,
  IsTrainingModuleId,
  type TrainingModuleId,
  type TrainingRunResult,
} from '@rehab-trainer/training-contracts';

export interface PeripheralAttentionRunTrial {
  practice?: boolean;
  correct?: boolean;
  responseTimeMs?: number;
  syncValid?: boolean;
}

export interface PeripheralAttentionRunSubtest {
  thresholdMs?: number;
  trialCount?: number;
  aborted?: boolean;
}

export interface PeripheralAttentionRunSummaryInput {
  moduleId: string;
  moduleVersion: string;
  status: TrainingRunResult['status'];
  startedAt: string | number | Date;
  endedAt?: string | number | Date;
  trials: readonly PeripheralAttentionRunTrial[];
  results: readonly PeripheralAttentionRunSubtest[];
  invalidTimingAttemptCount?: number;
}

/**
 * Summarize UFOV/peripheral-attention rows without leaking the detailed trial
 * table into the host protocol. Processing speed is kept as a metric because
 * it is a stimulus parameter conversion, not a clinical score.
 */
export function SummarizePeripheralAttentionRun(
  input: PeripheralAttentionRunSummaryInput,
): TrainingRunResult {
  const moduleId = NormalizeModuleId(input.moduleId);
  const trials = input.trials.filter((trial): trial is PeripheralAttentionRunTrial => (
    trial !== null && typeof trial === 'object'
  ));
  const formalTrials = trials.filter((trial) => trial.practice !== true);
  const correctCount = formalTrials.filter((trial) => trial.correct === true).length;
  const primary = input.results[0];
  const thresholdMs = ToFinitePositive(primary?.thresholdMs);
  const responseTimes = formalTrials
    .map((trial) => trial.responseTimeMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
  const metrics: Record<string, number | boolean | null> = {
    correctCount,
    formalTrialCount: formalTrials.length,
    accuracy: formalTrials.length > 0 ? correctCount / formalTrials.length : null,
    subtestCount: input.results.length,
    processingSpeedMs: thresholdMs,
    meanResponseTimeMs: responseTimes.length > 0
      ? responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length
      : null,
    invalidTimingAttemptCount: NormalizeCount(input.invalidTimingAttemptCount),
    abortedSubtestCount: input.results.filter((result) => result.aborted === true).length,
  };

  return CreateTrainingRunResult({
    moduleId,
    moduleVersion: input.moduleVersion,
    status: input.status,
    startedAt: ToIsoString(input.startedAt),
    durationMs: GetDurationMs(input.startedAt, input.endedAt),
    trialCount: trials.length,
    metrics,
  });
}

function NormalizeModuleId(value: string): TrainingModuleId {
  const normalized = String(value || '').trim();
  if (IsTrainingModuleId(normalized)) return normalized;
  if (normalized === 'attention-training' || normalized === 'ufov') return 'brain:ufov';
  return CreateTrainingModuleId('brain', normalized);
}

function NormalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0;
}

function ToFinitePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function GetDurationMs(
  startedAt: string | number | Date,
  endedAt: string | number | Date | undefined,
): number {
  if (endedAt === undefined) return 0;
  const start = ToTimestamp(startedAt);
  const end = ToTimestamp(endedAt);
  if (start === null || end === null) return 0;
  return Math.max(0, Math.round(end - start));
}

function ToIsoString(value: string | number | Date): string {
  const timestamp = ToTimestamp(value);
  return new Date(timestamp ?? Date.now()).toISOString();
}

function ToTimestamp(value: string | number | Date): number | null {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}
