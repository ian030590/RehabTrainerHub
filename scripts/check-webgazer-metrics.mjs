import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BuildGameScore, IsGameScore, ParseGameScoreDefinition } from '../packages/ui/src/gameScore.ts';
import { BuildOculomotorCsvRows } from '../apps/rehabtrainerhub/games/oculomotor-training/oculomotorCsvRows.ts';

const base = 'apps/rehabtrainerhub/games/oculomotor-training/';
const definition = ParseGameScoreDefinition(JSON.parse(readFileSync(`${base}score.json`, 'utf8')), 'oculomotor-training');
const runtime = readFileSync(`${base}public/reference/experiment.js`, 'utf8');
const wrapper = readFileSync(`${base}OculomotorTrainingGame.tsx`, 'utf8');
const overlay = readFileSync('apps/rehabtrainerhub/app/train/TrainingOverlay.tsx', 'utf8');

for (const metric of definition.columns) {
  assert.match(runtime, new RegExp(`\\b${metric.sources[0]}\\b`), `${metric.key} needs a reference experiment value`);
}
assert.match(runtime, /accuracy_rate: gazeCapture\.accuracyRate/);
assert.match(runtime, /gaze_sample_count: \(gazeCapture\.synchronousRecords \|\| \[\]\)\.length/);
assert.match(runtime, /gaze_records: gazeCapture\.synchronousRecords \|\| \[\]/);
assert.match(runtime, /upload: data\.eye_tracking\.enabled && data\.gaze_records\.length > 0/);
assert.ok(runtime.includes('config.eyeTrackingSource === EYE_SOURCE_WEBGAZER ? EYE_SOURCE_WEBGAZER : EYE_SOURCE_OFF'));
assert.match(wrapper, /SendHostedGameScore\(record/);
assert.match(wrapper, /UploadOculomotorCsv\(recordIdRef\.current, upload\)/);
assert.match(wrapper, /recordIdRef\.current = GetHostedGameSessionNonce\(\) \?\? recordIdRef\.current/);
assert.match(overlay, /module\.runtimeId === 'oculomotor-training' \? sessionNonce/);
assert.match(wrapper, /event\.source !== frameRef\.current\?\.contentWindow/);
assert.match(wrapper, /event\.origin !== window\.location\.origin/);

const tracked = {
  actual_duration_ms: 45000, completed_targets: 9, accuracy_rate: 67.5,
  valid_sec: 40, in_threshold_sec: 27, blink_sec: 5, gaze_sample_count: 1350,
  threshold_deg: 2.4, validation_error_deg: 1.2, estimated_refresh_hz: 60,
};
const score = BuildGameScore(definition, { details: tracked, detailRows: [tracked] });
assert.equal(IsGameScore(score, definition), true);
assert.equal(score.summary.accuracy, 67.5);
assert.equal(score.summary.samples, 1350);
assert.equal(score.rounds[0].onTargetSec, 27);

const untracked = { actual_duration_ms: 30000, completed_targets: 7 };
const untrackedScore = BuildGameScore(definition, { details: untracked, detailRows: [untracked] });
assert.equal(untrackedScore.summary.accuracy, null);
assert.equal(untrackedScore.summary.targets, 7);
assert.equal(definition.presentation.defaultRoundMetricKey, 'targets');
assert.equal(untrackedScore.rounds[0].targets, 7);
assert.equal(IsGameScore(untrackedScore, definition), true);

const [row] = BuildOculomotorCsvRows([{
  sample_index: 1, trial_time_ms: 12.6, device_timestamp_us: 1000,
  delta_t_ms: 30.3, instant_hz: 33, gaze_valid: 0, gaze_x_px: '', gaze_y_px: '',
  stimulus_x_px: 320, stimulus_y_px: 240, distance_error_px: '', distance_error_deg: '',
  is_within_threshold: 0, phase: 'movement', direction: 'rightUp',
}]);
assert.deepEqual(row, [1, 13, 1000, 30.3, 33, 0, null, null, 320, 240, null, null, 0, 'movement', 'up_right']);

console.log('Reference experiment score mapping passed.');
