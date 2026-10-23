// Result files a trusted official game stages with its container before it sends its result; the user downloads them
// later from the results page. The game iframe cannot download because it stays sandbox="allow-scripts".
// The standalone launcher inlines these with Function#toString, so they use only each other and browser globals.
// They also avoid named inner functions: the Workers bundler wraps those in a __name helper the launcher page lacks.

export const ufovTrialColumns = Object.freeze(['trial', 'practice', 'activity', 'planned_ms', 'exposure_ms', 'frames',
  'dropped_frames', 'refresh_hz', 'sync_valid', 'contrast_percent', 'vehicle_angle_deg', 'target_angle_deg', 'central_target',
  'central_response', 'central_correct', 'peripheral_axis', 'peripheral_response', 'peripheral_correct', 'trial_correct',
  'response_ms', 'trajectory_samples']);

export function IsUfovResultFileName(fileName) {
  return typeof fileName === 'string' && /^ufov-\d{8}-\d{6}-(?:trials\.csv|summary\.csv|trajectory\.json)$/.test(fileName);
}

// Every cell is a number, an empty cell or a fixed word, so a spreadsheet never reads a formula or identity.
export function IsUfovResultFile(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2
    || !IsUfovResultFileName(value.fileName) || typeof value.text !== 'string'
    || new TextEncoder().encode(value.text).byteLength > 4 * 1024 * 1024) return false;
  const number = /^-?\d{1,9}(?:\.\d{1,4})?$/;
  if (value.fileName.endsWith('-trials.csv')) {
    const lines = value.text.split('\r\n');
    return lines[0] === ufovTrialColumns.join(',') && lines.length >= 2 && lines.length <= 301
      && lines.slice(1).every((line) => {
        const cells = line.split(',');
        return cells.length === ufovTrialColumns.length
          && cells.every((cell) => cell === '' || cell === 'car' || cell === 'truck' || number.test(cell));
      });
  }
  if (value.fileName.endsWith('-summary.csv')) {
    const lines = value.text.split('\r\n');
    const sensitive = /(auth|email|jwt|name|password|token|user|participant|subject|secret|cookie|credential|phone)/i;
    return lines[0] === 'metric,value,unit' && lines.length >= 2 && lines.length <= 65
      && lines.slice(1).every((line) => {
        const cells = line.split(',');
        return cells.length === 3 && /^[a-z][a-z0-9_]{0,47}$/.test(cells[0]) && !sensitive.test(cells[0])
          && (number.test(cells[1]) || /^[a-z0-9_]{0,32}$/.test(cells[1])) && /^(?:ms|hz|cm|deg|percent|count|)$/.test(cells[2]);
      });
  }
  let data;
  try { data = JSON.parse(value.text); } catch { return false; }
  const keys = [...ufovTrialColumns, 'trajectory'];
  return [data, ...(Array.isArray(data?.trials) ? data.trials : [])].every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
    && Object.keys(data).length === 3 && data.schema === 'rehab-trainer.ufov-trajectory/v1'
    && [1, 2, 3].includes(data.activity) && Array.isArray(data.trials) && data.trials.length <= 300
    && data.trials.every((trial) => Object.keys(trial).length === keys.length
      && keys.every((key) => Object.hasOwn(trial, key))
      && ufovTrialColumns.every((key) => trial[key] === null || typeof trial[key] === 'boolean'
        || trial[key] === 'car' || trial[key] === 'truck'
        || (typeof trial[key] === 'number' && Number.isFinite(trial[key]) && Math.abs(trial[key]) <= 1e9))
      && Array.isArray(trial.trajectory) && trial.trajectory.length <= 5000
      && trial.trajectory.every((point) => Array.isArray(point) && point.length === 3
        && point.every((item) => Number.isInteger(item) && Math.abs(item) <= 1e7)));
}

// UFOV stages three files; a resend of the same name replaces the earlier text.
export function StageResultFile(files, file) {
  if (files.has(file.fileName) || files.size < 3) files.set(file.fileName, file.text);
}

export function ResultFileMimeType(fileName) {
  return fileName.endsWith('.json') ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8';
}

// CSV files get a byte order mark so spreadsheet apps read them as UTF-8.
export function DownloadResultFile(fileName, text) {
  const parts = fileName.endsWith('.csv') ? [String.fromCharCode(0xfeff), text] : [text];
  const url = URL.createObjectURL(new Blob(parts, { type: ResultFileMimeType(fileName) }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
