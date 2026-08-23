#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const checks = [
  {
    id: 'vision:acuity',
    file: 'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/AcuityTestPage.tsx',
    lifecycle: 'external-runtime-adapter',
    required: [
      'new JsPsychExternalLifecycle(',
      'lifecycle.start({',
      'jsPsychLifecycleRef.current?.finish(',
      "jsPsychLifecycleRef.current?.abort({ abort_reason: 'return-to-assessment' })",
      'jsPsychLifecycleRef.current?.dispose()',
    ],
  },
  {
    id: 'vision:contrast',
    file: 'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/ContrastTestPage.tsx',
    lifecycle: 'native-timeline',
    required: ['initJsPsych(', 'jsPsych.run(', 'abortExperiment('],
  },
  {
    id: 'vision:ufov-assessment',
    file: 'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/peripheral-attention/PeripheralAttentionPage.tsx',
    lifecycle: 'native-timeline',
    required: ['initJsPsych(', 'jsPsych.run(', 'finishTrial(', 'abortExperiment('],
  },
];

for (const check of checks) {
  const source = readFileSync(resolve(repoRoot, check.file), 'utf8');
  assert.ok(check.lifecycle, `${check.id} must declare a jsPsych lifecycle.`);
  for (const token of check.required) {
    assert.ok(source.includes(token), `${check.id} is missing jsPsych evidence: ${token}`);
  }
}

console.log(`Assessment jsPsych lifecycle check passed for ${checks.length} assessment runtimes.`);
