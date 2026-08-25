// Results view local to the Hub-owned oculomotor module.
import { ResultSummary } from '@rehab-trainer/ui/components/ResultSummary';
import type { ResultSummaryItem } from '@rehab-trainer/ui/components/ResultSummary';
import { FindOculomotorResult } from '../oculomotor/resultData';
import type { TFunction, TrialData } from '../types';

interface OculomotorResultsProps {
  results: TrialData[];
  userName: string;
  t: TFunction;
  oculomotorMode: string;
  oculomotorPattern: string;
}

export function OculomotorResults({
  results,
  userName,
  t,
  oculomotorMode,
  oculomotorPattern,
}: OculomotorResultsProps) {
  const result = FindOculomotorResult(results);
  const summaryItems: ResultSummaryItem[] = [
    { label: t('exp.res.mode'), value: t(`preset.mode.${result?.mode || oculomotorMode}` as any) },
    { label: t('exp.res.path'), value: t(`preset.path.${result?.pattern || oculomotorPattern}` as any) },
    { label: t('exp.res.acquired'), value: result?.acquired_targets ?? 0 },
    { label: t('exp.res.fps'), value: result?.average_fps ?? '-' },
  ];

  if (result?.aoi_score !== undefined) {
    summaryItems.push({ label: t('exp.res.aoi'), value: result.aoi_score });
  }
  if (result?.mean_target_distance_px !== undefined) {
    summaryItems.push({
      label: t('exp.res.meanTargetDistance'),
      value: FormatPixels(result.mean_target_distance_px, t),
    });
  }
  if (result?.target_distance_sd_px !== undefined) {
    summaryItems.push({
      label: t('exp.res.targetDistanceSd'),
      value: FormatPixels(result.target_distance_sd_px, t),
    });
  }
  if (result?.time_to_first_fixation_ms !== undefined) {
    summaryItems.push({
      label: t('exp.res.timeToFirstFixation'),
      value: result.time_to_first_fixation_ms === null
        ? t('exp.res.noFixation')
        : `${Math.round(result.time_to_first_fixation_ms)} ms`,
    });
  }
  if (result?.average_pupil_size_px !== undefined) {
    summaryItems.push({
      label: t('exp.res.pupilSizeEstimate'),
      value: FormatPixels(result.average_pupil_size_px, t),
    });
  }
  if (result?.pupil_size_sd_px !== undefined) {
    summaryItems.push({
      label: t('exp.res.pupilSizeSd'),
      value: FormatPixels(result.pupil_size_sd_px, t),
    });
  }
  if (result?.blink_count !== undefined) {
    summaryItems.push({
      label: t('exp.res.blinkCountEstimate'),
      value: result.blink_count ?? t('exp.res.unavailable'),
    });
  }
  const gazeSampleCount = result?.gaze_sample_count ?? result?.gaze_samples?.length;
  if (gazeSampleCount !== undefined) {
    summaryItems.push({ label: t('exp.res.gazeSampleCount'), value: gazeSampleCount });
  }
  summaryItems.push({ label: t('exp.res.user'), value: userName, emphasize: false });

  return (
    <>
      <div className="results-score">
        {Math.round((result?.duration_ms ?? 0) / 1000)}s
      </div>
      <ResultSummary items={summaryItems} />
    </>
  );
}

function FormatPixels(value: number | null, t: TFunction): string {
  return value === null || !Number.isFinite(value)
    ? t('exp.res.unavailable')
    : `${value.toFixed(1)} px`;
}
