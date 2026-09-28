const directions: Record<string, string> = {
  center: 'center', rightUp: 'up_right', rightMiddle: 'right', rightDown: 'down_right',
  middleDown: 'down', leftDown: 'down_left', leftMiddle: 'left', leftUp: 'up_left', middleUp: 'up',
};

const optionalNumber = (value: unknown) => value === '' || value === null || value === undefined
  ? null : Number(value);

export function BuildOculomotorCsvRows(records: Record<string, unknown>[]) {
  return records.map((sample) => [
    Number(sample.sample_index),
    Math.round(Number(sample.trial_time_ms)),
    optionalNumber(sample.device_timestamp_us),
    optionalNumber(sample.delta_t_ms),
    optionalNumber(sample.instant_hz),
    Number(sample.gaze_valid),
    optionalNumber(sample.gaze_x_px),
    optionalNumber(sample.gaze_y_px),
    optionalNumber(sample.stimulus_x_px),
    optionalNumber(sample.stimulus_y_px),
    optionalNumber(sample.distance_error_px),
    optionalNumber(sample.distance_error_deg),
    Number(sample.is_within_threshold),
    String(sample.phase),
    directions[String(sample.direction)] ?? String(sample.direction),
  ]);
}
