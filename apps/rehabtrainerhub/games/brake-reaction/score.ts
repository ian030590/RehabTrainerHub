import { BuildResult, type Row } from './src/score.js';
import type { Settings } from './src/settings';

export function BuildGameScore(settings: Settings, rows: readonly Row[]) {
  if (rows.length !== 6 || rows.some(row => !Number.isFinite(row.r) || row.r < .1 || row.r > 2.5)) {
    throw new RangeError('A session requires six bounded reaction times.');
  }
  return BuildResult(settings, rows);
}
