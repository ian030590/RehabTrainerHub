import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { settingsSections } from '../apps/rehabtrainerhub/games/oculomotor-training/settings.ts';

const base = resolve('apps/rehabtrainerhub/games/oculomotor-training');
const read = (name) => readFileSync(resolve(base, name), 'utf8');
const runtime = read('public/reference/experiment.js');
const fields = settingsSections.flatMap(section => section.fields);
const field = (key) => fields.find(item => item.key === key);

assert.deepEqual(field('module').options.map(option => option.value), ['vor', 'pursuit', 'saccade', 'fixation']);
assert.deepEqual(field('eyeTrackingSource').options.map(option => option.value), ['webgazer', 'off']);
assert.equal(fields.filter(item => /^axis[0-7]Enabled$/.test(item.key)).length, 8);
for (const [key, value] of Object.entries({ vorTotalSec: 30, pursuitTotalSec: 45, saccadeTotalSec: 45, fixationTotalSec: 60 })) {
  assert.equal(field(key).default, value);
}
assert.match(runtime, /calibration_points: \[\[10,10\],\[50,10\],\[90,10\],\[10,50\],\[50,50\],\[90,50\],\[10,90\],\[50,90\],\[90,90\]\]/);
assert.match(runtime, /repetitions_per_point: 2/);
assert.match(runtime, /\}, 1050\);[\s\S]*\}, 350\);/);
assert.match(runtime, /const PASS_THRESHOLD_DEG = 3\.5/);
assert.match(runtime, /Math\.max\(0\.5, meanErrorDeg \* 2\)/);
assert.match(runtime, /trialTime - frame\.phase_started_ms < 200/);
assert.match(runtime, /Math\.min\(deltaMs > 100 \? 1000 \/ 33 : deltaMs, trialTime\)/);
assert.match(runtime, /Math\.max\(baseDeg \+ allowanceDeg, validationDeg \|\| 0\)/);
assert.match(runtime, /\["middleUp", "rightUp", "rightMiddle", "rightDown", "middleDown", "leftDown", "leftMiddle", "leftUp"\]/);
assert.match(runtime, /fallBackToUntrackedSession\(data\.error \|\| "Camera setup failed\."\)/);
assert.match(runtime, /AppState\.pending\.eyeTrackingSource === EYE_SOURCE_OFF/);
assert.match(runtime, /type: OptionalWebGazerCameraPlugin/);
assert.match(runtime, /type: GazeValidationPlugin/);
assert.doesNotMatch(runtime + read('settings.ts') + read('OculomotorTrainingGame.tsx'), /TobiiBridge|EYE_SOURCE_TOBII|tobiiCalibrated|"tobii"/i);

for (const [name, expected] of Object.entries({
  'jspsych.js': '0ec03e513351fd0f2b59a192fea85aafe6ef1b21e0e2648f5ded475acdcc418c',
  'webgazer.js': '6210f977f5d146b40cfe82f0b845113171441ffbcb7aabdb2d65717507957081',
})) {
  const path = name === 'webgazer.js' ? resolve('apps/usergamerunner/runtime/WEBGAZER-SOURCE.txt') : resolve(base, 'public/reference', name);
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  assert.equal(actual, expected, `${name} must retain the referenced vendor implementation`);
}

console.log('Reference WebGazer protocol and settings contract passed.');
