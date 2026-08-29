#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const Read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const visionSummarizer = Read('apps/rehabtrainerhub/training-modules/vision/utils/trainingRunResult.ts');
const peripheralSummarizer = Read('apps/rehabtrainerhub/training-modules/brain/pages/peripheral-attention/peripheralAttentionRunResult.ts');
const trainingContracts = Read('packages/training-contracts/src/index.js');
const visionRecords = Read('apps/rehabtrainerhub/training-modules/vision/utils/trainingRecords.ts');
const brainRecords = Read('apps/rehabtrainerhub/training-modules/brain/utils/trainingRecords.ts');
const ufovPage = Read('apps/rehabtrainerhub/training-modules/brain/pages/peripheral-attention/PeripheralAttentionPage.tsx');
const visionPage = Read('apps/rehabtrainerhub/training-modules/vision/pages/training/TrainingPage.tsx');
const nativeEngine = Read('apps/rehabtrainerhub/training-modules/shared/nativeTimelineEngine.ts');
const sharedRunResult = Read('apps/rehabtrainerhub/training-modules/shared/trainingRunResult.ts');
const ufovSetup = Read('apps/rehabtrainerhub/training-modules/brain/ufov/setup.tsx');

assert.match(trainingContracts, /export function CreateTrainingRunResult/,
  'training contracts must expose the canonical run-result constructor.');
assert.match(visionSummarizer, /CreateTrainingRunResult/,
  'Vision summarizers must use the canonical run-result constructor.');
assert.match(peripheralSummarizer, /CreateTrainingRunResult/,
  'Peripheral-attention summarizers must use the canonical run-result constructor.');
assert.match(visionPage, /SummarizeVisionTrainingRun/,
  'Vision timeline records must persist a compact run result.');
assert.match(ufovPage, /SummarizePeripheralAttentionRun/,
  'UFOV records must persist a compact run result.');
assert.match(visionRecords, /runResult:\s*ToTrainingRunResult/,
  'Vision record hydration must validate the optional run result.');
assert.match(brainRecords, /runResult:\s*ToTrainingRunResult/,
  'Brain record hydration must validate the optional run result.');
assert.match(nativeEngine, /CreateNativeTimelineEngine/,
  'Native timeline modules must use the shared renderer-independent lifecycle wrapper.');
assert.match(sharedRunResult, /IsTrainingRunResult/,
  'Persisted run results must use the shared contracts validator with a bounded fallback.');
assert.match(ufovSetup, /SummarizePeripheralAttentionRun/,
  'UFOV setup must use the compact run-result summarizer.');
assert.match(ufovPage, /RegisterPeripheralAttentionAbortSignal/,
  'UFOV plugin must expose host-owned abort registration.');
assert.doesNotMatch(visionSummarizer, /metrics\.(?:auth|email|jwt|name|password|token|user)/i,
  'Vision run summaries must not add sensitive metric names.');
assert.doesNotMatch(peripheralSummarizer, /metrics\.(?:auth|email|jwt|name|password|token|user)/i,
  'Peripheral-attention run summaries must not add sensitive metric names.');

for (const relativePath of [
  'apps/rehabtrainerhub/training-modules/motor/drawing-defense/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/asteroid-shield/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/gesture-battler/setup.tsx',
  'apps/rehabtrainerhub/training-modules/motor/motor-cortex-rehab/setup.tsx',
  'apps/rehabtrainerhub/training-modules/mouth/tongue-catch/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/moving-card/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/oculomotor/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/gabor-patching/setup.tsx',
  'apps/rehabtrainerhub/training-modules/vision/reading-training/setup.tsx',
  'apps/rehabtrainerhub/training-modules/brain/ufov/setup.tsx',
  'apps/rehabtrainerhub/training-modules/brain/every-ball-response/setup.tsx',
]) {
  assert.ok(existsSync(resolve(repoRoot, relativePath)), `Missing native setup: ${relativePath}`);
  const setupSource = Read(relativePath);
  assert.match(setupSource, /CreateTrainingRunResult|SummarizeVisionTrainingRun|SummarizePeripheralAttentionRun/, `${relativePath} must produce the canonical run result`);
  assert.match(setupSource, /summarize:/, `${relativePath} must declare a bounded result summarizer`);
}

console.log('Native run-result boundary passed: target module setups use one sanitized envelope.');
