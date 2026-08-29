#!/usr/bin/env node

/**
 * Static integration contract for the Hub training journey.
 *
 * This gate intentionally does not need a browser or a built output. It
 * protects the seams that connect the lobby, official host, generated
 * single-game PWA, progress links, and storage migration. Browser/network
 * acceptance remains a separate deployment gate because it requires a real
 * browser and service-worker lifecycle.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const Read = (relativePath) => readFileSync(resolve(repoRoot, relativePath), 'utf8');

const manifestModule = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/moduleFlowManifest.ts',
  {
    '@rehab-trainer/training-contracts': pathToFileURL(
      resolve(repoRoot, 'packages/training-contracts/src/index.js'),
    ).href,
    '@rehab-trainer/ui/officialTrainingHostPolicy': `data:text/javascript;base64,${Buffer.from(
      "export const officialTrainingHostRoutePrefix = '/official-training-host';",
    ).toString('base64')}`,
  },
);

const {
  trainingModuleFlowManifest,
  trainingModuleRegistry,
} = manifestModule;

const catalogSource = Read('apps/rehabtrainerhub/training-modules/catalog.ts');
const flowManifestSource = Read('apps/rehabtrainerhub/training-modules/moduleFlowManifest.ts');
const catalogIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((match) => `${match[2]}:${match[1]}`);
assert.ok(catalogIds.length > 0, 'the catalog must expose at least one built-in module');
assert.equal(new Set(catalogIds).size, catalogIds.length, 'catalog module IDs must be unique');

const lobbySource = Read('apps/rehabtrainerhub/app/TrainingLobby.tsx');
const overlaySource = Read('apps/rehabtrainerhub/app/train/TrainingOverlay.tsx');
const embeddedSource = Read('apps/rehabtrainerhub/app/train/EmbeddedTraining.tsx');
const progressSource = Read('apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx');
const hostRouteSource = Read('apps/rehabtrainerhub/app/official-training-host/[domain]/[slug]/page.tsx');
const hostSource = Read('apps/rehabtrainerhub/app/official-training-host/OfficialTrainingHost.tsx');
const pwaGeneratorSource = Read('scripts/emit-official-game-pwas.mjs');
const pwaOutputCheckerSource = Read('scripts/check-official-game-pwa-output.mjs');
const storageSource = Read('packages/ui/src/storage/runtimeNamespace.ts');
const pwaSource = Read('packages/ui/src/pwa.tsx');
const runnerRendererSource = Read('apps/usergamerunner/functions/_lib/render.js');

for (const catalogId of catalogIds) {
  const entry = trainingModuleRegistry[catalogId];
  const flow = trainingModuleFlowManifest[catalogId];
  assert.ok(entry, `registry entry is missing for ${catalogId}`);
  assert.ok(flow, `flow manifest is missing for ${catalogId}`);
  const [trainer, slug] = catalogId.split(':');
  assert.equal(entry.hostPath, `/official-training-host/${trainer}/${slug}/`);
  assert.equal(entry.officialPwa.scope, `/games/${slug}/`);
  assert.equal(entry.officialPwa.manifestPath, `/games/${slug}/manifest.webmanifest`);
  assert.equal(entry.officialPwa.serviceWorkerPath, `/games/${slug}/sw.js`);
  assert.equal(entry.officialPwa.offlineManifestPathPrefix, `/offline-manifests/${slug}/`);
  assert.equal(flow.sourcePath, entry.sourcePath);
}

// Lobby -> overlay -> official host is one route source of truth. The
// compatibility runtime URL is allowed only inside the official host route,
// never in a card or overlay event handler.
assert.match(lobbySource, /setActiveModule\(module\)/);
assert.match(lobbySource, /<TrainingOverlay module=\{activeModule\}/);
assert.match(overlaySource, /BuildTrainingModuleHref/);
assert.match(overlaySource, /new OfficialTrainingHostSession/);
assert.match(overlaySource, /hostSessionRef\.current\?\.dispose\(\)/);
assert.match(overlaySource, /sandbox=\{iframePolicy\.sandboxTokens\.join\(' '\)\}/);
assert.doesNotMatch(overlaySource, /BuildLegacyTrainingModuleHref/);
assert.match(embeddedSource, /searchParams\.get\('module'\)/);
assert.match(embeddedSource, /router\.push\('\/'\)/);
assert.match(hostRouteSource, /dynamicParams = false/);
assert.match(hostRouteSource, /generateStaticParams/);
assert.match(hostRouteSource, /notFound\(\)/);
assert.match(hostRouteSource, /BuildLegacyTrainingModuleHref/);
assert.match(hostSource, /ValidateTrainingEnvelope/);

// Progress must resolve a recent module back through the catalog and return
// to the same /train overlay entry, rather than recreating a runtime route.
assert.match(progressSource, /trainingCatalog\.find\(\(module\) => module\.runtimeId === recentModule\.moduleId\)/);
assert.match(progressSource, /BuildHubTrainingHref\(module\)/);
assert.doesNotMatch(progressSource, /BuildLegacyTrainingModuleHref/);

// Single-game PWA metadata and the platform SW are generated from the same
// registry entry. Installing a PWA is not allowed to imply an offline pack.
assert.match(pwaGeneratorSource, /BuildGameServiceWorker/);
assert.match(pwaGeneratorSource, /manifest\.webmanifest/);
assert.match(flowManifestSource, /serviceWorkerPath/);
assert.match(pwaGeneratorSource, /offlineManifest/);
assert.match(pwaGeneratorSource, /includeDynamicImports:\s*false/);
assert.match(pwaGeneratorSource, /install-offline-pack/);
assert.match(pwaOutputCheckerSource, /ValidateOfflineResources/);
assert.match(pwaOutputCheckerSource, /ValidateGameOutput/);
assert.match(pwaSource, /isStandaloneGamePath/);
assert.match(runnerRendererSource, /RenderServiceWorker/);
assert.match(runnerRendererSource, /manifest\.webmanifest/);

// Retired runtime keys are copied before deletion, and every module owns a
// stable namespace. Keep this assertion source-based so it runs before a
// browser is available; the executable migration behavior remains covered by
// check-runtime-storage-namespaces.mjs.
for (const runtime of ['motor', 'vision', 'brain', 'mouth']) {
  const settingsSource = Read(`apps/rehabtrainerhub/training-modules/${runtime}/utils/settings.ts`);
  assert.match(settingsSource, /CreateRuntimeStorageNamespace\(['"](?:motor|vision|brain|mouth)['"]\)/);
  assert.match(settingsSource, /MigrateLegacyLocalStorageNamespace/);
}
assert.match(storageSource, /MigrateLegacyIndexedDbRecords/);
assert.match(storageSource, /DeleteIndexedDb/);
assert.match(storageSource, /failed copy leaves the source database untouched/);

console.log(`Training integration contract passed for ${catalogIds.length} catalog modules, official host routes, PWA metadata, progress links, and storage migration.`);

async function LoadTypeScriptModule(relativePath, replacements = {}) {
  let source = Read(relativePath);
  for (const [specifier, replacement] of Object.entries(replacements)) {
    source = source
      .replaceAll(`from '${specifier}'`, `from '${replacement}'`)
      .replaceAll(`from "${specifier}"`, `from "${replacement}"`);
  }
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
