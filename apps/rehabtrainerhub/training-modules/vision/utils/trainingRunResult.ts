import {
  CreateTrainingModuleId,
  CreateTrainingRunResult,
  IsTrainingModuleId,
  type TrainingModuleId,
  type TrainingRunResult,
} from '@rehab-trainer/training-contracts';
import type { TrialData } from '../pages/training/types';

export const visionNativeRunModuleIds = Object.freeze([
  'moving-card',
  'oculomotor-training',
  'gabor-patching',
  'reading-training',
] as const);

export function IsVisionNativeRunModule(moduleId: string): boolean {
  const normalized = String(moduleId || '').trim();
  return visionNativeRunModuleIds.includes(normalized as (typeof visionNativeRunModuleIds)[number]);
}

export interface VisionTrainingRunSummaryInput {
  moduleId: string;
  moduleVersion: string;
  status: TrainingRunResult['status'];
  startedAt: string | number | Date;
  endedAt?: string | number | Date;
  trials: readonly TrialData[];
}

/**
 * Convert the module-owned raw trial rows into the one result envelope used by
 * the host protocol and persisted records. The raw rows remain available for
 * exports; this summary is deliberately small and never contains user or
 * gaze-identifying fields.
 */
export function SummarizeVisionTrainingRun(
  input: VisionTrainingRunSummaryInput,
): TrainingRunResult {
  const moduleId = NormalizeVisionModuleId(input.moduleId);
  const trials = input.trials.filter((trial): trial is TrialData => (
    trial !== null && typeof trial === 'object'
  ));
  const correctCount = trials.filter((trial) => trial.correct === true).length;
  const scoredTrials = trials.filter((trial) => (
    typeof trial.correct === 'boolean'
    || Number.isFinite(trial.score)
    || Number.isFinite(trial.aoi_score)
    || Number.isFinite(trial.acquired_targets)
  ));
  const accuracy = scoredTrials.length > 0
    ? correctCount / scoredTrials.length
    : null;
  const first = trials[0];
  const score = GetModuleScore(moduleId, first);
  const metrics: Record<string, number | boolean | null> = {
    correctCount,
    accuracy,
    scoredTrialCount: scoredTrials.length,
  };
  if (Number.isFinite(first?.acquired_targets)) {
    metrics.acquiredTargets = first.acquired_targets as number;
  }
  if (Number.isFinite(first?.aoi_score)) {
    metrics.aoiScore = first.aoi_score as number;
  }
  if (Number.isFinite(first?.average_rt)) {
    metrics.averageReactionTimeMs = first.average_rt as number;
  }
  if (Number.isFinite(first?.reading_time)) {
    metrics.readingTimeMs = first.reading_time as number;
  }

  return CreateTrainingRunResult({
    moduleId,
    moduleVersion: input.moduleVersion,
    status: input.status,
    startedAt: ToIsoString(input.startedAt),
    durationMs: GetDurationMs(input.startedAt, input.endedAt),
    trialCount: trials.length,
    ...(score === null ? {} : { score }),
    metrics,
  });
}

function NormalizeVisionModuleId(value: string): TrainingModuleId {
  const normalized = String(value || '').trim();
  if (IsTrainingModuleId(normalized)) return normalized;
  return CreateTrainingModuleId('vision', normalized);
}

function GetModuleScore(
  moduleId: TrainingModuleId,
  trial: TrialData | undefined,
): number | null {
  if (!trial) return null;
  if (moduleId === 'vision:oculomotor-training') {
    return FirstFinite(trial.aoi_score, trial.acquired_targets, trial.score);
  }
  if (moduleId === 'vision:gabor-patching') return FirstFinite(trial.score);
  return null;
}

function FirstFinite(...values: readonly unknown[]): number | null {
  const value = values.find((candidate) => (
    typeof candidate === 'number' && Number.isFinite(candidate)
  ));
  return typeof value === 'number' ? value : null;
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
