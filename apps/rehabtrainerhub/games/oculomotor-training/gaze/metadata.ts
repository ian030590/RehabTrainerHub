export const oculomotorMetadataKeys = [
  'mode', 'pattern', 'eye_tracking_source', 'screen_width_px', 'screen_height_px',
  'viewing_distance_cm', 'css_px_per_cm', 'duration_ms', 'validation_error_deg',
  'gaze_threshold_deg', 'gaze_threshold_arcmin', 'gaze_sampling_interval_ms',
  'fixation_radius_px', 'fixation_duration_ms',
] as const;

export function BuildOculomotorMetadata(trial: Record<string, unknown> | undefined) {
  const metadata: Record<string, string | number> = {};
  for (const key of oculomotorMetadataKeys) {
    const value = trial?.[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9) metadata[key] = value;
    if (typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value)) metadata[key] = value;
  }
  return metadata;
}
