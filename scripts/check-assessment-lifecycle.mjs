#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hubRoot = resolve(repoRoot, 'apps/rehabtrainerhub');
const gamesRoot = resolve(hubRoot, 'games');

// Assert that retired directories do not exist
assert.equal(existsSync(resolve(hubRoot, 'training-runtimes')), false, 'training-runtimes directory must not exist');
assert.equal(existsSync(resolve(hubRoot, 'training-modules')), false, 'training-modules directory must not exist');
assert.equal(existsSync(resolve(gamesRoot, '_shared')), false, 'games/_shared directory must not exist');

const repositoryReadme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

for (const retiredReadmeClaim of [
  '視覺練習：視標',
  'Visual Practice: visual-target',
  'michaelbach/FrACT10',
]) {
  assert.equal(
    repositoryReadme.includes(retiredReadmeClaim),
    false,
    `The repository README must not restore retired visual-target copy: ${retiredReadmeClaim}`,
  );
}

// Check dictionaries in packages/ui
for (const locale of ['zh', 'en']) {
  const dictionary = readFileSync(
    resolve(repoRoot, `apps/rehabtrainerhub/games/oculomotor-training/i18n/${locale}.ts`),
    'utf8',
  );
  for (const retiredToken of [
    "'nav.assessment'",
    "'assess.",
    "'acuity.",
    "'credits.fract",
    "'btn.startTest'",
    "'btn.selectTest'",
    'FrACT',
    'Visual Target Practice',
  ]) {
    assert.equal(
      dictionary.includes(retiredToken),
      false,
      `Vision ${locale} dictionary must not restore retired visual-target copy: ${retiredToken}`,
    );
  }
}

// Check that games do not expose retired assessment tokens
for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const gameDir = resolve(gamesRoot, entry.name);
  for (const file of readdirSync(gameDir)) {
    if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const source = readFileSync(resolve(gameDir, file), 'utf8');
      for (const retiredToken of [
        '/acuity-test',
        '/contrast-test',
        'AcuityTestPage',
        'ContrastTestPage',
        'PeripheralAttentionAssessmentPage',
      ]) {
        assert.equal(
          source.includes(retiredToken),
          false,
          `Game ${entry.name}/${file} must not expose retired assessment token: ${retiredToken}`,
        );
      }
    }
  }
}

for (const retiredFile of [
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/AssessmentPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/AcuityTestPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/ContrastTestPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/assessment/PeripheralAttentionAssessmentPage.tsx',
  'apps/rehabtrainerhub/training-modules/vision/experiment/plugins/pixi-contrast-sensitivity.ts',
  'apps/rehabtrainerhub/training-modules/vision/pages/assessment/logic/optotypeRenderer.ts',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/settings/SettingsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/settings/CalibrationTab.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/settings/GeneralTab.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/settings/SettingRow.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/credits/CreditsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/HomePage.tsx',
  'apps/rehabtrainerhub/training-runtimes/motor/src/pages/home/trainingModules.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/settings/SettingsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/vision/src/pages/credits/CreditsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/brain/src/pages/settings/SettingsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/brain/src/pages/ReferencesPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/mouth/src/pages/settings/SettingsPage.tsx',
  'apps/rehabtrainerhub/training-runtimes/mouth/src/pages/ReferencesPage.tsx',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-contrast.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-gratings.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-landolt.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-letters.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-peripheral-attention.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-pictures.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-tumbling-e.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/assessment-ufov.webp',
]) {
  assert.equal(existsSync(resolve(repoRoot, retiredFile)), false, `Retired runtime file must stay deleted: ${retiredFile}`);
}

console.log('Build adapters remain module-only and retired Vision visual-target routes stay absent.');
