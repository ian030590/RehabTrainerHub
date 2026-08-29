#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const selectionCardSource = Read('packages/ui/src/components/SelectionCard.tsx');
assert.doesNotMatch(selectionCardSource, /on(?:Focus|PointerEnter|TouchStart)=\{onPreload\}/,
  'Selection cards must not preload a runtime on focus, hover, or touch.');
assert.doesNotMatch(selectionCardSource, /onPreload\??\s*:/,
  'SelectionCard must not expose a runtime preload callback.');

const selectionPageSource = Read('packages/ui/src/components/TrainingModuleSelectionPage.tsx');
assert.doesNotMatch(selectionPageSource, /onPreload/,
  'The shared selection page must not wire card events to runtime preloading.');

const lobbySource = Read('apps/rehabtrainerhub/app/TrainingLobby.tsx');
assert.doesNotMatch(lobbySource, /PreloadTrainingModule|rel\s*=\s*["']prefetch["']/,
  'The Hub lobby must not prefetch official runtime documents from a catalog card.');
assert.doesNotMatch(lobbySource, /on(?:Focus|PointerEnter|PointerDown|TouchStart)=\{[^}]*Preload/,
  'The Hub lobby must not attach runtime preload handlers to catalog cards.');
assert.doesNotMatch(lobbySource, /rel\s*=\s*["']preconnect["']/,
  'The Hub lobby must not preconnect to third-party game origins before a user selects a game.');
const trainingOverlaySource = Read('apps/rehabtrainerhub/app/train/TrainingOverlay.tsx');
assert.match(trainingOverlaySource, /BuildTrainingModuleHref/,
  'Catalog launches must resolve the generated official-training-host route.');
assert.doesNotMatch(trainingOverlaySource, /BuildLegacyTrainingModuleHref/,
  'The Hub overlay must not launch a category runtime directly.');

const visionHomeSource = Read('apps/rehabtrainerhub/training-modules/vision/pages/HomePage.tsx');
assert.doesNotMatch(visionHomeSource, /PreloadTrainingRoute\(\)\s*;?\s*\}\s*,\s*\[\s*\]\s*\)/,
  'Vision home must not preload the training route before the rules transition.');
assert.match(visionHomeSource, /const moduleId = rulesModule;[\s\S]{0,400}preloadEngineOnce\(moduleId\)/,
  'Vision engine preloading must be triggered from the rules-visible transition.');
assert.doesNotMatch(visionHomeSource, /PreloadTrainingEngine\(expandedModule\)/,
  'Config expansion must not preload a heavy vision engine.');
assert.match(visionHomeSource, /enginePreloadRef/,
  'Vision rules preload must reuse one promise for repeated open/close transitions.');
assert.match(visionHomeSource, /CreateSingleFlightPreloadCache/,
  'Vision rules preload must use the shared single-flight cache.');
assert.match(visionHomeSource, /AbortSignal/,
  'Vision engine loading must receive an AbortSignal.');
assert.match(visionHomeSource, /enginePreloadRef\.current\?\.clear/,
  'Leaving rules/config must clear and dispose the pending engine preload.');
assert.match(visionHomeSource, /WarmUpPixiTrainingRuntime\(moduleId, signal\)/,
  'Pixi warmup must observe the rules preload abort signal.');

const hostSource = Read('apps/rehabtrainerhub/app/official-training-host/OfficialTrainingHost.tsx');
for (const heavyToken of [
  "from 'jspsych'",
  "from 'pixi.js'",
  "from 'three'",
  "@mediapipe/",
  "@tensorflow/",
  'webgazer',
]) {
  assert.doesNotMatch(hostSource, new RegExp(EscapeRegExp(heavyToken)),
    `Official host entry must not statically import ${heavyToken}.`);
}

const setupRegistrySource = Read('apps/rehabtrainerhub/training-modules/registry/setupLoaders.ts');
assert.match(setupRegistrySource, /GetTrainingSetupLoader/,
  'The official host must resolve setup modules through the generated loader registry.');
assert.match(setupRegistrySource, /import\([^)]*\/setup['"]?\)/,
  'Native setup modules must stay behind a dynamic import boundary.');

const movingCardSetupSource = Read('apps/rehabtrainerhub/training-modules/vision/moving-card/setup.tsx');
const timelineSetupFactorySource = Read('apps/rehabtrainerhub/training-modules/vision/createTimelineSetup.tsx');
const sharedTimelineSetupFactorySource = Read('apps/rehabtrainerhub/training-modules/shared/createTimelineSetup.tsx');
const officialPwaGeneratorSource = Read('scripts/emit-official-game-pwas.mjs');
const nativeSetupSources = {
  'motor:drawing-defense': Read('apps/rehabtrainerhub/training-modules/motor/drawing-defense/setup.tsx'),
  'motor:asteroid-shield': Read('apps/rehabtrainerhub/training-modules/motor/asteroid-shield/setup.tsx'),
  'motor:gesture-battler': Read('apps/rehabtrainerhub/training-modules/motor/gesture-battler/setup.tsx'),
  'motor:motor-cortex-rehab': Read('apps/rehabtrainerhub/training-modules/motor/motor-cortex-rehab/setup.tsx'),
  'mouth:tongue-catch': Read('apps/rehabtrainerhub/training-modules/mouth/tongue-catch/setup.tsx'),
  'brain:every-ball-response': Read('apps/rehabtrainerhub/training-modules/brain/every-ball-response/setup.tsx'),
  'vision:moving-card': movingCardSetupSource,
  'vision:oculomotor-training': Read('apps/rehabtrainerhub/training-modules/vision/oculomotor/setup.tsx'),
  'vision:gabor-patching': Read('apps/rehabtrainerhub/training-modules/vision/gabor-patching/setup.tsx'),
  'vision:reading-training': Read('apps/rehabtrainerhub/training-modules/vision/reading-training/setup.tsx'),
  'brain:ufov': Read('apps/rehabtrainerhub/training-modules/brain/ufov/setup.tsx'),
};
for (const [moduleId, setupSource] of Object.entries(nativeSetupSources)) {
  for (const heavyToken of [
  "from 'jspsych'",
  "from 'pixi.js'",
  "from 'three'",
  "from '@mediapipe/",
  "from '@tensorflow/",
  "from 'webgazer'",
  ]) {
    assert.doesNotMatch(setupSource, new RegExp(EscapeRegExp(heavyToken)),
      `${moduleId} setup must not statically import ${heavyToken}.`);
  }
  assert.match(setupSource, /Create(?:VisionTimelineSetup|TimelineSetup|ComponentTrainingSetup)/,
    `${moduleId} setup must use the light setup factory.`);
  assert.match(setupRegistrySource, new RegExp(EscapeRegExp(`'${moduleId}':`)),
    `${moduleId} must be present in the native setup loader registry.`);
}
assert.match(timelineSetupFactorySource, /CreateTimelineSetup/,
  'Vision setup aliases must point at the shared timeline setup factory.');
assert.match(sharedTimelineSetupFactorySource, /import\(['"]jspsych['"]\)/,
  'The shared timeline setup factory must dynamically import jsPsych inside loadEngine.');
assert.match(officialPwaGeneratorSource, /ResolvePwaShellModulePath/,
  'Official PWA output must resolve the selected launcher route from the module registry.');
assert.match(officialPwaGeneratorSource, /includeDynamicImports:\s*false/,
  'Official PWA shell closure must not follow every lazy engine import.');
assert.match(officialPwaGeneratorSource, /PrecacheShell/,
  'Official PWA install must precache only the light shell.');
assert.match(officialPwaGeneratorSource, /install-offline-pack/,
  'Official PWA heavy assets must require an explicit offline-pack action.');
const nativeSurfaceSource = Read('apps/rehabtrainerhub/app/official-training-host/NativeTrainingSurface.tsx');
assert.match(nativeSurfaceSource, /trigger:\s*'rules-visible'/,
  'Native host surface must retain the rules-visible engine loading trigger.');
assert.match(nativeSurfaceSource, /engineLoadGenerationRef/,
  'Native host surface must invalidate late engine-loader continuations.');
assert.match(nativeSurfaceSource, /runGenerationRef/,
  'Native host surface must invalidate late run-result continuations.');
assert.match(nativeSurfaceSource, /disposeGenerationRef/,
  'Native host surface must invalidate stale asynchronous disposals.');
assert.match(nativeSurfaceSource, /generation !== engineLoadGenerationRef\.current/,
  'Late engine loads must fail closed after a host transition.');
assert.match(nativeSurfaceSource, /generation !== runGenerationRef\.current/,
  'Late run results must not resurrect a disposed host surface.');
assert.match(nativeSurfaceSource, /engineRef\.current !== engine/,
  'Late run handles must not attach to a newer engine session.');
assert.match(nativeSurfaceSource, /engineLoadGenerationRef\.current \+= 1/,
  'Aborting a pending run must invalidate the engine preload generation.');
assert.match(nativeSurfaceSource, /enginePromiseRef\.current = null/,
  'Aborting a pending run must release the engine preload promise.');
const sharedTimelineEngineSource = Read('apps/rehabtrainerhub/training-modules/shared/nativeTimelineEngine.ts');
assert.match(sharedTimelineEngineSource, /startingRun/,
  'Native timeline engine must reject concurrent starts while a timeline is preparing.');
assert.match(sharedTimelineEngineSource, /if \(activeRun \|\| startingRun\)/,
  'Native timeline engine start mutex must cover both active and pending runs.');
assert.match(hostSource, /GetTrainingSetupLoader/,
  'Official host must resolve native setup loaders without importing an engine.');
assert.match(hostSource, /NativeTrainingSurface/,
  'Official host must mount the typed native setup surface when a loader is available.');

console.log('Heavy-load boundary passed: cards stay setup-only and rules own the cached engine preload.');

function Read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
