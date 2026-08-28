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
  if (source.includes('training-config-actions')) {
    failures.push(`${relativeFile}: uses removed training-config-actions class`);
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

const routeOutletSource = readFileSync(resolve(root, 'packages/ui/src/components/TrainerRouteOutlet.tsx'), 'utf8');
for (const required of [
  'className="trainer-route-transition"',
  'key={location.pathname}',
  '<Outlet />',
]) {
  if (!routeOutletSource.includes(required)) failures.push(`TrainerRouteOutlet is missing ${required}`);
}

for (const relativeFile of [
  'apps/rehabtrainerhub/training-runtimes/brain/src/App.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/App.tsx',
  'apps/rehabtrainerhub/training-runtimes/mouth/src/App.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/App.tsx',
]) {
  const source = readFileSync(resolve(root, relativeFile), 'utf8');
  if (!source.includes('<TrainerRouteOutlet />')) {
    failures.push(`${relativeFile}: does not use the shared subroute transition outlet`);
  }
}

const styleSource = readFileSync(resolve(root, 'packages/ui/src/components/TrainerApp.css'), 'utf8');
for (const required of [
  '.training-slider {',
  '.training-slider-control {',
  '.training-slider-scale {',
  '.trainer-route-transition {',
  '.config-modal-overlay > .training-config {',
  'border: 1.5px solid var(--border)',
  '.training-option-toggle + .training-option-toggle',
  '.training-slider-scale > span:nth-child(2)',
  '.training-slider-scale > span:last-child',
  '@keyframes trainerRouteEnter',
  '@keyframes trainingConfigExpand',
]) {
  if (!styleSource.includes(required)) failures.push(`TrainerApp.css is missing ${required}`);
}

if (styleSource.includes('.training-config-actions')) {
  failures.push('TrainerApp.css still defines removed .training-config-actions styles');
}

const hubNavigationSource = readFileSync(resolve(root, 'apps/rehabtrainerhub/app/HubNavigation.tsx'), 'utf8');
const hubStyleSource = readFileSync(resolve(root, 'apps/rehabtrainerhub/app/globals.css'), 'utf8');
if (!hubNavigationSource.includes('key={pathname}')) {
  failures.push('HubNavigation does not key its subroute transition by pathname');
}
for (const required of ['.hub-route-transition {', '@keyframes hubRouteEnter']) {
  if (!hubStyleSource.includes(required)) failures.push(`Hub globals.css is missing ${required}`);
}

if (failures.length) {
  throw new Error(`Training config style check failed:\n${failures.map((failure) => `  - ${failure}`).join('\n')}`);
}

console.log('Training config style consistency check passed.');
