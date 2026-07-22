#!/usr/bin/env node
import assert from 'node:assert/strict';
import { DiscoverPagesApps, SelectChangedTrainers } from './pages-apps.mjs';

const pagesApps = DiscoverPagesApps();
const trainers = pagesApps.filter((app) => app.role === 'trainer');
assert.ok(trainers.length > 0, 'At least one Trainer must be discovered from app metadata.');

for (const trainer of trainers) {
  const selected = SelectChangedTrainers(pagesApps, [`${trainer.appPath}/src/main.tsx`]);
  assert.deepEqual(selected.map((app) => app.appName), [trainer.appName]);
}

assert.equal(SelectChangedTrainers(pagesApps, ['apps/rehabtrainerhub/app/page.tsx']).length, 0);
assert.equal(SelectChangedTrainers(pagesApps, ['README.md']).length, 0);
assert.deepEqual(
  SelectChangedTrainers(pagesApps, ['packages/ui/src/index.ts']).map((app) => app.appName),
  trainers.map((app) => app.appName),
);
assert.deepEqual(
  SelectChangedTrainers(pagesApps, null).map((app) => app.appName),
  trainers.map((app) => app.appName),
);

console.log(`Changed Trainer smoke selection passed for ${trainers.length} discovered Trainer(s).`);
