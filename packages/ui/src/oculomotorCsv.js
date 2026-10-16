const columns = [
  'sample_index', 'trial_time_ms', 'device_timestamp_us', 'delta_t_ms', 'instant_hz',
  'gaze_valid', 'gaze_x_px', 'gaze_y_px', 'stimulus_x_px', 'stimulus_y_px',
  'distance_error_px', 'distance_error_deg', 'is_within_threshold', 'phase', 'direction',
];
const referenceColumns = [...columns, 'browser_received_trial_time_ms', 'transport_delay_ms', 'stimulus_frame_time_ms',
  'clock_mapping', 'target_number', 'accuracy_eligible', 'accuracy_delta_t_ms', 'gaze_velocity_deg_s', 'is_fixation', 'tff_ms'];
const metadataKeys = [
  'mode', 'pattern', 'run_mode', 'stimulus_type', 'eye_tracking_source',
  'screen_width_px', 'screen_height_px', 'screen_width_cm', 'screen_height_cm',
  'viewing_distance_cm', 'css_px_per_cm', 'css_px_per_cm_y', 'duration_ms',
  'target_size_arcmin', 'speed_arcmin_sec', 'dwell_ms', 'hold_ms', 'vor_change_ms',
  'validation_error_deg',
  'gaze_threshold_deg', 'gaze_threshold_arcmin', 'gaze_sampling_interval_ms',
  'fixation_radius_px', 'fixation_duration_ms',
];
const textMetadataKeys = new Set(['mode', 'pattern', 'run_mode', 'stimulus_type', 'eye_tracking_source']);
const phases = new Set(['training', 'saccade_latency', 'idle', 'cross', 'movement', 'return', 'arrival_frame', 'dwell', 'hold', 'vor']);
const directions = new Set([
  'center', 'right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right',
]);
export function IsOculomotorCsvPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 2 || !Object.hasOwn(value, 'records') || !Object.hasOwn(value, 'metadata')
    || !Array.isArray(value.records) || value.records.length < 1 || value.records.length > 36000
    || !value.metadata || typeof value.metadata !== 'object' || Array.isArray(value.metadata)
    || value.metadata.eye_tracking_source !== 'webgazer'
    || Object.entries(value.metadata).some(([key, item]) => !metadataKeys.includes(key)
      || (textMetadataKeys.has(key) ? typeof item !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(item)
        : typeof item !== 'number' || !Number.isFinite(item) || item < 0 || item > 1e9))
    || new TextEncoder().encode(JSON.stringify(value)).byteLength > 8 * 1024 * 1024) return false;
  let previousTime = -1;
  return value.records.every((row, index) => {
    if (!Array.isArray(row) || row.length !== columns.length
      || row[0] !== index + 1
      || !Number.isInteger(row[1]) || row[1] < previousTime || row[1] > 1200000
      || (row[2] !== null && (!Number.isSafeInteger(row[2]) || row[2] < 0))
      || ![5, 12].every((at) => row[at] === 0 || row[at] === 1)
      || ![3, 4, 6, 7, 8, 9, 10, 11].every((at) => row[at] === null
        || (typeof row[at] === 'number' && Number.isFinite(row[at]) && row[at] >= -1e6 && row[at] <= 1e6))
      || !phases.has(row[13])
      || !directions.has(row[14])) return false;
    if (row[8] === null || row[9] === null || row[3] === null) return false;
    if ([3, 4, 10, 11].some((at) => row[at] !== null && row[at] < 0)) return false;
    if (row[5] === 1 && [6, 7, 10, 11].some((at) => row[at] === null)) return false;
    if (row[5] === 0 && (row[6] !== null || row[7] !== null || row[10] !== null || row[11] !== null || row[12] !== 0)) return false;
    previousTime = row[1];
    return true;
  });
}

export function IsReferenceCsvPayload(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 2 || typeof value.text !== 'string'
    || new TextEncoder().encode(value.text).byteLength > 8 * 1024 * 1024
    || typeof value.fileName !== 'string' || !/^[A-Za-z0-9_.-]{1,160}\.csv$/.test(value.fileName)) return false;
  const lines = value.text.split('\r\n');
  const header = lines.findIndex(line => line.startsWith('sample_index,'));
  const selectedColumns = lines[header] === referenceColumns.join(',') ? referenceColumns : columns;
  return header > 0 && lines[header] === selectedColumns.join(',') && lines.slice(0, header).every(line => line.startsWith('# '))
    && lines.slice(header + 1).every((line, index) => {
      const row = line.split(',');
      return row.length === selectedColumns.length && Number(row[0]) === index + 1
        && row.every((cell, at) => [13, 14, 18].includes(at)
          ? /^"[A-Za-z_ -]+"$/.test(cell) : cell === '' || /^-?\d+(?:\.\d+)?$/.test(cell));
    });
}
