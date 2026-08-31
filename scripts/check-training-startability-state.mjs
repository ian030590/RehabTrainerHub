#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const surfacePath = resolve(
  repoRoot,
  'apps/rehabtrainerhub/app/official-training-host/NativeTrainingSurface.tsx',
);
const source = readFileSync(surfacePath, 'utf8');

const loadStart = source.indexOf('const ensureEngine = async');
const startRunStart = source.indexOf('const start = async', loadStart);
assert.ok(loadStart >= 0 && startRunStart > loadStart, 'NativeTrainingSurface.ensureEngine() is missing.');

const ensureEngineSource = source.slice(loadStart, startRunStart);
assert.match(
  ensureEngineSource,
  /setPhase\(['"]loading['"]\)/,
  'Engine preload must expose an explicit loading state.',
);

const attachIndex = ensureEngineSource.indexOf('engineRef.current = engine');
const returnIndex = ensureEngineSource.indexOf('return engine', attachIndex);
assert.ok(attachIndex >= 0 && returnIndex > attachIndex, 'Successful engine attachment is missing.');

const successfulAttachment = ensureEngineSource.slice(attachIndex, returnIndex);
assert.match(
  successfulAttachment,
  /setPhase\(['"]rules['"]\)/,
  'Successful engine preload must leave loading and restore a startable rules state.',
);

assert.match(
  source,
  /data-training-action=["']start["'][\s\S]{0,240}disabled=\{phase === ['"]loading['"]\}/,
  'The start action must remain disabled only while engine preload is genuinely pending.',
);
assert.match(
  source,
  /data-phase=\{phase\}/,
  'The native surface must expose its lifecycle phase for browser acceptance diagnostics.',
);

console.log('Training startability state contract passed: engine loading always returns to a startable rules state.');
