#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const drawingDefensePath = resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-modules/motor/pages/training/DrawingTowerDefenseGame.tsx',
);
const source = readFileSync(drawingDefensePath, 'utf8');

for (const pattern of [
  /drawingSampleUploadEndpoint/i,
  /drawingSampleUploadToken/i,
  /VITE_DRAWING_SAMPLE_UPLOAD/i,
  /\/api\/drawing-samples/i,
  /discord/i,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bRTCPeerConnection\b/,
  /\bnavigator\.sendBeacon\s*\(/,
]) {
  assert.doesNotMatch(
    source,
    pattern,
    `Drawing Defense must not contain an automatic external-data request (${pattern}).`,
  );
}

assert.match(
  source,
  /Drawing data stays in the session result and is never uploaded from the/,
  'The privacy boundary must remain documented next to the drawing module.',
);
assert.match(
  source,
  /SaveTrainingSessionRecord\(/,
  'Drawing Defense must continue to persist only its normal first-party session result.',
);

console.log('Training privacy boundary passed: Drawing Defense has no browser-side sample upload or external transport.');
