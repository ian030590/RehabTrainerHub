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

const visionHomeSource = Read('apps/rehabtrainerhub/training-modules/vision/pages/HomePage.tsx');
assert.match(visionHomeSource, /if \(!rulesModule\) return;[\s\S]{0,240}preloadEngineOnce\(rulesModule\)/,
  'Vision engine preloading must be triggered from the rules-visible transition.');
assert.doesNotMatch(visionHomeSource, /PreloadTrainingEngine\(expandedModule\)/,
  'Config expansion must not preload a heavy vision engine.');
assert.match(visionHomeSource, /enginePreloadRef/,
  'Vision rules preload must reuse one promise for repeated open/close transitions.');

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

console.log('Heavy-load boundary passed: cards stay setup-only and rules own the cached engine preload.');

function Read(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
