import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const hostSource = await readFile(
  new URL('../apps/rehabtrainerhub/app/official-training-host/OfficialTrainingHost.tsx', import.meta.url),
  'utf8',
);
const hostEntryForbidden = /(?:\bjspsych\b|@jspsych|pixi(?:\.js)?|three|mediapipe|tensorflow|webgazer|vosk)/i;
assert.equal(hostEntryForbidden.test(hostSource), false, 'official host entry must not import heavy engines');
assert.match(hostSource, /MessagePort/);
assert.match(hostSource, /IsTrainingHostConnect/);
assert.match(hostSource, /ValidateTrainingEnvelope/);

const policySource = await readFile(
  new URL('../packages/ui/src/officialTrainingHostPolicy.ts', import.meta.url),
  'utf8',
);
assert.match(policySource, /allow-scripts/);
assert.match(policySource, /allow-same-origin/);
assert.match(policySource, /referrerPolicy: 'no-referrer'/);
assert.match(policySource, /featureAllowlist/);

console.log('Official training host boundary passed: light entry, private channel, and central policy are present.');
