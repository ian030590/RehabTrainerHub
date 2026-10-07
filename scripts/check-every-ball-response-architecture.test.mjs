import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const gameRoot = new URL('../apps/rehabtrainerhub/games/every-ball-response/', import.meta.url);

test('Every Ball Response uses one native accessible game with optional camera and microphone', async () => {
  const [entry, game, settings, manifest] = await Promise.all([
    readFile(new URL('main.tsx', gameRoot), 'utf8'),
    readFile(new URL('EveryBallResponsePage.tsx', gameRoot), 'utf8'),
    readFile(new URL('settings.json', gameRoot), 'utf8').then(JSON.parse),
    readFile(new URL('../apps/rehabtrainerhub/games/moduleFlowManifest.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(entry, /OfficialGameShell/);
  const fields = settings.sections.flatMap(section => section.fields);
  const input = fields.find(field => field.key === 'inputMode');
  assert.deepEqual(input?.options.map(option => option.value), ['touch', 'camera', 'microphone']);
  assert.equal(input.default, 'touch');
  assert.ok(fields.some(field => field.key === 'fixationStyle'));
  assert.ok(fields.some(field => field.key === 'microphoneSensitivity'));
  assert.match(game, /every-ball-stimulus/);
  assert.match(game, /every-ball-action/);
  assert.match(game, /SaveTrainingRecord\s*\(/);
  assert.match(game, /TrainingResultActions/);
  assert.doesNotMatch(game, /initJsPsych|from 'pixi\.js'|new Application\(/);
  assert.match(manifest, /\['brain:every-ball-response', 'every-ball-response\/EveryBallResponsePage\.tsx', 'camera-or-microphone', 'browser-native'\]/);
});
