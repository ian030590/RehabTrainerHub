#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const visionApp = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/src/App.tsx',
), 'utf8');
const visionNavbar = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/src/components/Navbar.tsx',
), 'utf8');
const visionZh = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/src/i18n/zh.ts',
), 'utf8');
const visionEn = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/src/i18n/en.ts',
), 'utf8');
const visionStyles = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/src/index.css',
), 'utf8');
const motorStyles = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/motor/src/index.css',
), 'utf8');
const visionIndex = readFileSync(resolve(
  repoRoot,
  'apps/rehabtrainerhub/training-runtimes/vision/index.html',
), 'utf8');
const repositoryReadme = readFileSync(resolve(repoRoot, 'README.md'), 'utf8');

for (const runtime of ['motor', 'vision', 'brain', 'mouth']) {
  const app = readFileSync(resolve(
    repoRoot,
    `apps/rehabtrainerhub/training-runtimes/${runtime}/src/App.tsx`,
  ), 'utf8');
  const navbar = readFileSync(resolve(
    repoRoot,
    `apps/rehabtrainerhub/training-runtimes/${runtime}/src/components/Navbar.tsx`,
  ), 'utf8');
  for (const retiredShellRoute of ['/settings', '/references', '/credits', '/links']) {
    for (const routeToken of [`path="${retiredShellRoute}"`, `to="${retiredShellRoute}"`]) {
      assert.equal(
        app.includes(routeToken) || navbar.includes(routeToken),
        false,
        `${runtime} runtime shell must contain modules only; remove ${routeToken}.`,
      );
    }
  }
  for (const locale of ['zh', 'en']) {
    const dictionary = readFileSync(resolve(
      repoRoot,
      `apps/rehabtrainerhub/training-runtimes/${runtime}/src/i18n/${locale}.ts`,
    ), 'utf8');
    for (const retiredShellKey of [
      "'nav.settings'",
      "'nav.references'",
      "'nav.credits'",
      "'nav.links'",
      "'credits.",
      "'links.",
      "'assess.",
      "'acuity.",
      "'btn.startTest'",
      "'btn.selectTest'",
      "'training.returnSettings'",
    ]) {
      assert.equal(
        dictionary.includes(retiredShellKey),
        false,
        `${runtime} ${locale} dictionary must not restore retired shell copy: ${retiredShellKey}`,
      );
    }
  }
}

for (const retiredMotorSelector of [
  '.settings-tab',
  '.webgazer-fullscreen-overlay',
  '.webgazer-pl-',
  '.assessment-disclaimer',
  '.acuity-',
  '.touch-btn-ring',
  '.key-hints-',
]) {
  assert.equal(
    motorStyles.includes(retiredMotorSelector),
    false,
    `Motor runtime CSS must not bundle retired settings/visual-target selector: ${retiredMotorSelector}`,
  );
}

for (const retiredToken of [
  '/assessment',
  '/acuity-test',
  '/contrast-test',
  'AssessmentPage',
  'AcuityTestPage',
  'ContrastTestPage',
  'PeripheralAttentionAssessmentPage',
]) {
  assert.equal(
    visionApp.includes(retiredToken),
    false,
    `Vision runtime must not expose the retired visual-target assessment token: ${retiredToken}`,
  );
}
assert.equal(
  visionNavbar.includes("t('nav.assessment')"),
  false,
  'Vision runtime navigation must contain training modules only.',
);

for (const [locale, dictionary] of [['zh', visionZh], ['en', visionEn]]) {
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

for (const retiredSelector of [
  '.assessment-',
  '.acuity-',
  '.contrast-fullscreen-root',
  '.contrast-running-stage',
  '.webgazer-pl-intro',
  '.webgazer-pl-badge',
  '.key-hints-',
  '.touch-btn-ring',
  '.touch-btn-cross',
  '.touch-btn-letters',
  '.touch-btn-pictures',
]) {
  assert.equal(
    visionStyles.includes(retiredSelector),
    false,
    `Vision CSS must not restore retired visual-target selector: ${retiredSelector}`,
  );
}

for (const retiredPublicClaim of [
  '視標辨識',
  '對比辨識',
  'Visual Target Practice',
  'FrACT',
  '/assessment',
  '/acuity',
]) {
  assert.equal(
    visionIndex.includes(retiredPublicClaim),
    false,
    `Vision public metadata must not restore retired visual-target claim: ${retiredPublicClaim}`,
  );
}
for (const retainedModule of ['移動卡片', '眼動', '蓋伯斑塊', '閱讀', '哈特圖', '駕駛注意力']) {
  assert.equal(
    visionIndex.includes(retainedModule),
    true,
    `Vision public metadata must describe the retained ${retainedModule} module.`,
  );
}
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

console.log('Runtime shells remain module-only and retired Vision visual-target routes stay absent.');
