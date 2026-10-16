export interface ExperimentResult {
  actual_duration_ms: number; completed_targets: number; accuracy_rate: number | null;
  valid_sec: number | null; in_threshold_sec: number | null; blink_sec: number | null;
  gaze_sample_count: number | null; threshold_deg: number | null; validation_error_deg: number | null;
  estimated_refresh_hz: number | null; end_reason: string; module: string; eye_tracking_source: 'webgazer' | 'off';
  tff_mean_ms?: number | null; tff_detected_targets?: number | null; tff_total_targets?: number | null;
  tff_analysis?: { targets: { target_number: number; direction: string; tff_ms: number | null; status: string }[] } | null;
}
export const scoreMetrics = [
  {
    "key": "durationMs",
    "source": "actual_duration_ms",
    "label": {
      "zh": "當次刺激時間",
      "en": "Stimulus duration"
    },
    "unit": "ms"
  },
  {
    "key": "targets",
    "source": "completed_targets",
    "label": {
      "zh": "完成目標數",
      "en": "Completed targets"
    },
    "unit": ""
  },
  {
    "key": "accuracy",
    "source": "accuracy_rate",
    "label": {
      "zh": "有效眼動時間在標比例",
      "en": "On target share of valid gaze time"
    },
    "unit": "%"
  },
  {
    "key": "validSec",
    "source": "valid_sec",
    "label": {
      "zh": "有效眼動時間",
      "en": "Valid gaze duration"
    },
    "unit": "s"
  },
  {
    "key": "onTargetSec",
    "source": "in_threshold_sec",
    "label": {
      "zh": "在標時間",
      "en": "On target duration"
    },
    "unit": "s"
  },
  {
    "key": "blinkSec",
    "source": "blink_sec",
    "label": {
      "zh": "無效眼動時間",
      "en": "Invalid gaze duration"
    },
    "unit": "s"
  },
  {
    "key": "samples",
    "source": "gaze_sample_count",
    "label": {
      "zh": "逐筆眼動樣本數",
      "en": "Gaze sample count"
    },
    "unit": ""
  },
  {
    "key": "thresholdDeg",
    "source": "threshold_deg",
    "label": {
      "zh": "當次在標門檻",
      "en": "On target threshold"
    },
    "unit": "deg"
  },
  {
    "key": "validationErrorDeg",
    "source": "validation_error_deg",
    "label": {
      "zh": "五點驗證平均誤差",
      "en": "Five point validation mean error"
    },
    "unit": "deg"
  },
  {
    "key": "refreshHz",
    "source": "estimated_refresh_hz",
    "label": {
      "zh": "估計畫面更新率",
      "en": "Estimated display refresh rate"
    },
    "unit": "Hz"
  },
  { key: 'tffMeanMs', source: 'tff_mean_ms', label: { zh: '首次注視平均時間', en: 'Mean time to first fixation' }, unit: 'ms' },
  { key: 'tffDetectedTargets', source: 'tff_detected_targets', label: { zh: '偵測首次注視目標數', en: 'Targets with detected fixation' }, unit: '' }
] as const;
export function IsExperimentResult(value: unknown): value is ExperimentResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return ['vor', 'pursuit', 'saccade', 'fixation'].includes(String(result.module))
    && ['webgazer', 'off'].includes(String(result.eye_tracking_source))
    && typeof result.end_reason === 'string' && result.end_reason.length <= 80
    && typeof result.actual_duration_ms === 'number' && Number.isFinite(result.actual_duration_ms) && result.actual_duration_ms >= 0
    && Number.isSafeInteger(result.completed_targets) && Number(result.completed_targets) >= 0
    && scoreMetrics.every(field => result[field.source] === null || (field.source.startsWith('tff_') && result[field.source] === undefined) || (typeof result[field.source] === 'number'
      && Number.isFinite(result[field.source]) && Number(result[field.source]) >= 0))
    && (result.accuracy_rate === null || Number(result.accuracy_rate) <= 100)
    && (result.gaze_sample_count === null || (Number.isSafeInteger(result.gaze_sample_count) && Number(result.gaze_sample_count) <= 36000));
}
export function BuildGameScore(result: ExperimentResult) {
  const summary: Record<string, number | null> = Object.fromEntries(scoreMetrics.map(field => [field.key, result[field.source] ?? null]));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'oculomotor-training', summary, rounds: [{ ...summary }] };
}
