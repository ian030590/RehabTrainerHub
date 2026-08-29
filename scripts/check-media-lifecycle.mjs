#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(repoRoot, 'apps/rehabtrainerhub/training-modules');

const mediaModules = {
  'motor:asteroid-shield': 'motor/pages/training/AsteroidShieldGame.tsx',
  'motor:gesture-battler': 'motor/pages/training/GestureBattlerGame.tsx',
  'motor:motor-cortex-rehab': 'motor/pages/training/MotorCortexRehabGame.tsx',
  'brain:every-ball-response': 'brain/pages/EveryBallResponsePage.tsx',
  'mouth:tongue-catch': 'mouth/pages/training/TongueCatchGame.tsx',
};

const mediaPreflightSource = ReadSource('packages/ui/src/hooks/useMediaPermissionPreflight.ts');
const mediaStreamSource = ReadSource('packages/ui/src/mediaStream.ts');
assert.match(
  mediaPreflightSource,
  /navigator\.mediaDevices\.getUserMedia\(/,
  'The shared media preflight must be the only permission probe implementation.',
);
assert.match(
  mediaPreflightSource,
  /StopMediaStream\(stream\)/,
  'Permission probes must delegate stream cleanup to the shared disposer.',
);
assert.match(
  mediaStreamSource,
  /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/,
  'Permission probes must stop every track immediately after permission is granted.',
);

for (const [moduleId, relativePath] of Object.entries(mediaModules)) {
  const source = ReadSource(`apps/rehabtrainerhub/training-modules/${relativePath}`);

  assert.match(source, /useMediaPermissionPreflight/, `${moduleId} must use the shared media preflight hook.`);
  assert.match(source, /active:\s*phase\s*===\s*['"]menu['"]/, `${moduleId} preflight must run only while its config/menu is active.`);
  assert.match(source, /getUserMedia\(\s*\{/, `${moduleId} must acquire its real stream at run start.`);
  assert.match(
    source,
    /StopMediaStream\(/,
    `${moduleId} must use the shared stream disposer during runtime disposal.`,
  );
  if (moduleId !== 'brain:every-ball-response') {
    assert.match(
      source,
      /if \(!mountedRef\.current \|\| phaseRef\.current !== ['"]initializing['"]\) \{[\s\S]{0,240}StopMediaStream\(stream\)/,
      `${moduleId} must dispose a stream that resolves after the run was cancelled.`,
    );
    assert.match(
      source,
      /if \(!mountedRef\.current \|\| phaseRef\.current !== ['"]initializing['"]\) \{[\s\S]{0,360}landmarker\.close\(\)[\s\S]{0,240}StopMediaStream\(stream\)/,
      `${moduleId} must dispose model resources and the stream after an async model load race.`,
    );
  }

  const lifecycleStart = FindFirstIndex(source, [
    'jsPsychLifecycleRef.current?.start({',
    'jsPsych.run([',
  ]);
  const streamStart = source.search(/getUserMedia\(\s*\{/);
  assert.ok(lifecycleStart >= 0, `${moduleId} must have an explicit jsPsych run boundary.`);
  assert.ok(
    streamStart > lifecycleStart,
    `${moduleId} must not open its real media stream before jsPsych starts the trial.`,
  );
}

const everyBallSource = ReadSource('apps/rehabtrainerhub/training-modules/brain/pages/EveryBallResponsePage.tsx');
assert.match(
  everyBallSource,
  /on_input_start:/,
  'Every Ball Response must acquire media from inside its jsPsych trial lifecycle.',
);
assert.match(
  everyBallSource,
  /inputRuntimeRef\.current = runtime/,
  'Every Ball Response must retain its runtime only after the native trial starts.',
);
assert.match(
  everyBallSource,
  /CreateCameraRuntime[\s\S]{0,5000}catch \(error\) \{[\s\S]{0,320}StopMediaStream\(stream\)/,
  'Every Ball camera initialization must release a stream when model setup fails.',
);
assert.match(
  everyBallSource,
  /CreateMicrophoneRuntime[\s\S]{0,5000}catch \(error\) \{[\s\S]{0,320}StopMediaStream\(stream\)/,
  'Every Ball microphone initialization must release a stream when audio setup fails.',
);

const webgazerCalibrationSource = ReadSource(
  'apps/rehabtrainerhub/training-modules/vision/utils/webgazerCalibration.ts',
);
assert.match(
  webgazerCalibrationSource,
  /@jspsych\/plugin-webgazer-init-camera/,
  'Oculomotor training must keep camera ownership in the native WebGazer jsPsych timeline.',
);
assert.match(
  webgazerCalibrationSource,
  /type:\s*WebGazerInitCameraPlugin/,
  'Oculomotor training must request camera access through its native init-camera trial.',
);

console.log(`Media lifecycle contract passed for ${Object.keys(mediaModules).length + 1} camera/microphone modules.`);

function ReadSource(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function FindFirstIndex(source, tokens) {
  return Math.min(
    ...tokens
      .map((token) => source.indexOf(token))
      .filter((index) => index >= 0),
    Number.POSITIVE_INFINITY,
  );
}
