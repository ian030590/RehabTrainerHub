import { gazeRecordColumns } from './gaze/gazeScoring';
import { FindOculomotorResult } from './results/resultData';
import { GetAuthToken, GetAuthUserIdFromToken } from '@rehab-trainer/ui/auth/authClient';
import { GetOrCreateSubjectIdForUser } from '@rehab-trainer/ui/storage/subjectId';

const csvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'number' ? String(value) : String(value).replace(/^[=+\-@\t\r]/, "'$&");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function DownloadTrainingCsv({
  results,
  moduleId,
  oculomotorMode,
  oculomotorPattern,
  t,
}: any) {
  if (results.length === 0) return;
  const result = FindOculomotorResult(results);
  const subjectId = GetOrCreateSubjectIdForUser(GetAuthUserIdFromToken(GetAuthToken()));
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE');
  const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false }).replace(/:/g, '');
  const source = result?.eye_tracking_source ?? 'off';
  const records = Array.isArray(result?.gaze_records) ? result.gaze_records : [];

  const metadata = [
    ['subject_id', subjectId],
    ['date', dateStr],
    ['time', timeStr],
    ['module', moduleId],
    ['mode', t(`preset.mode.${result?.mode || oculomotorMode}`)],
    ['path', t(`preset.path.${result?.pattern || oculomotorPattern}`)],
    ['eye_tracking_source', source],
    ['screen_width_px', result?.screen_width_px],
    ['screen_height_px', result?.screen_height_px],
    ['viewing_distance_cm', result?.viewing_distance_cm],
    ['css_px_per_cm', result?.css_px_per_cm],
    ['duration_ms', result?.duration_ms],
    ['validation_error_deg', result?.validation_error_deg],
    ['gaze_threshold_deg', result?.gaze_threshold_deg],
    ['gaze_threshold_arcmin', result?.gaze_threshold_arcmin],
    ['valid_gaze_ms', result?.valid_gaze_ms],
    ['invalid_gaze_ms', result?.invalid_gaze_ms],
    ['in_threshold_ms', result?.in_threshold_ms],
    ['accuracy_percent', result?.aoi_score],
    ['gaze_sample_count', result?.gaze_sample_count],
    ['average_pupil_size_px_estimate', result?.average_pupil_size_px],
    ['blink_count_estimate', result?.blink_count],
  ].map(([key, value]) => [`# ${key}`, value ?? '']);
  const rows = [
    ...metadata,
    [...gazeRecordColumns],
    ...records,
  ];
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${subjectId}_${moduleId}_${dateStr}_${timeStr}_${source}_gaze_record.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
