const legacySummaryFields = new Set([
  'trial_type', 'score', 'total_score', 'accuracy', 'total', 'correct', 'incorrect', 'trial_count', 'duration_ms',
  'mean_rt', 'mode', 'pattern', 'gaze_coordinate_source', 'mean_target_distance_px', 'target_distance_sd_px',
  'time_to_first_fixation_ms', 'average_pupil_size_px', 'pupil_size_sd_px', 'blink_count', 'gaze_sample_count',
  'webgazer_sample_count', 'webgazer_data_consumed', 'gaze_samples_omitted', 'webgazer_data_omitted',
  'aoi_score', 'valid_gaze_ms', 'in_threshold_ms', 'sampling_hz', 'fixation_count',
]);

export function RemoveGazeSamples(value) {
  if (Array.isArray(value)) return value.map(RemoveGazeSamples);
  if (!IsPlainObject(value)) return value;

  let pairedSamplesOmitted = false;
  let nativeSamplesOmitted = false;
  const entries = [];
  Object.entries(value).forEach(([key, item]) => {
    if (key === 'gaze_samples') {
      pairedSamplesOmitted = true;
      return;
    }
    if (key === 'webgazer_data') {
      nativeSamplesOmitted = true;
      return;
    }
    if (key === 'gaze_samples_omitted' || key === 'webgazer_data_omitted') return;
    entries.push([key, RemoveGazeSamples(item)]);
  });
  if (pairedSamplesOmitted || value.gaze_samples_omitted === true) {
    entries.push(['gaze_samples_omitted', true]);
  }
  if (nativeSamplesOmitted || value.webgazer_data_omitted === true) {
    entries.push(['webgazer_data_omitted', true]);
  }
  return Object.fromEntries(entries);
}

export function SummaryOnlyRecord(value, key = '') {
  if (Array.isArray(value)) {
    // Legacy clients wrap their summary in results; only known summary fields survive this envelope.
    return key === 'results' && value.length === 1 && IsPlainObject(value[0]) && !Object.hasOwn(value[0], 'trial_index')
      ? [Object.fromEntries(Object.entries(value[0]).filter(([field, item]) => legacySummaryFields.has(field)
        && (item === null || ['number', 'boolean', 'string'].includes(typeof item))))] : [];
  }
  if (!IsPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([field, item]) => [field, SummaryOnlyRecord(item, field)]));
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
