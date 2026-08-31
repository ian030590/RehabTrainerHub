#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const configFiles = [
  'apps/rehabtrainerhub/training-modules/vision/pages/HomePage.tsx',
  'apps/rehabtrainerhub/training-modules/brain/pages/ModulePage.tsx',
  'packages/ui/src/components/PeripheralAttentionConfigComponents.tsx',
];
const failures = [];

for (const relativeFile of configFiles) {
  const source = readFileSync(resolve(root, relativeFile), 'utf8');
  if (source.includes('training-config-inline-actions')) {
    failures.push(`${relativeFile}: uses removed training-config-inline-actions class`);
  }
}

const sliderSource = readFileSync(resolve(root, 'packages/ui/src/components/TrainingConfigRangeField.tsx'), 'utf8');
for (const required of [
  'className="training-slider"',
  'className="training-slider-header"',
  'className="training-slider-value"',
  'className="training-slider-scale"',
  'type="range"',
]) {
  if (!sliderSource.includes(required)) failures.push(`TrainingSlider is missing ${required}`);
}

const styleSource = readFileSync(resolve(root, 'packages/ui/src/components/TrainerApp.css'), 'utf8');
for (const required of [
  '.training-slider {',
  '.training-slider-scale {',
  'border: 1.5px solid var(--border)',
  '.training-slider-scale > span:nth-child(2)',
  '.training-slider-scale > span:last-child',
]) {
  if (!styleSource.includes(required)) failures.push(`TrainerApp.css is missing ${required}`);
}

if (failures.length) {
  throw new Error(`Training config style check failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
}

console.log('Training config style consistency check passed.');
