import assert from 'node:assert/strict';
import test from 'node:test';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import {
  dirname,
  join,
  relative,
  resolve,
} from 'node:path';
import {
  fileURLToPath,
  pathToFileURL,
} from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(repoRoot, 'apps/rehabtrainerhub/training-modules');

const heavyPackagePattern = /^(?:jspsych|pixi\.js|three|@mediapipe\/|@tensorflow(?:-models)?\/|webgazer|vosk(?:-|$))/i;
const inScopeLifecycleExceptions = new Set([
  'vision:hart-chart',
  'vision:driving-rehab',
]);
// These are the existing compatibility adapters. A new module may not add a
// second legacy lifecycle path; it must start with the native jsPsych owner.
const knownLegacyAdapterIds = new Set([
  'motor:drawing-defense',
  'motor:asteroid-shield',
  'motor:gesture-battler',
  'motor:motor-cortex-rehab',
  'vision:hart-chart',
  'brain:minesweeper',
  'brain:reaction-time',
  'brain:whack-a-mole',
  'brain:memory-match',
  'brain:simon-says',
  'brain:lights-out',
  'brain:sliding-puzzle',
  'brain:sudoku',
  'brain:tic-tac-toe',
  'brain:connect4',
  'brain:dots-and-boxes',
  'brain:hex',
  'brain:maze',
  'mouth:tongue-catch',
]);

const manifestModule = await LoadTypeScriptModule(
  'apps/rehabtrainerhub/training-modules/moduleFlowManifest.ts',
  {
    '@rehab-trainer/training-contracts': pathToFileURL(
      resolve(repoRoot, 'packages/training-contracts/src/index.js'),
    ).href,
  },
);

test('module identity and lifecycle remain generated from one registry', () => {
  const {
    standardTrainingFlow,
    trainingModuleFlowManifest,
    trainingModuleManifests,
    trainingModuleRegistry,
    trainingModuleImplementationVersion,
  } = manifestModule;
  const expectedFlow = ['card', 'config', 'rules', 'training', 'results'];
  const ids = Object.keys(trainingModuleFlowManifest);

  assert.ok(ids.length > 0, 'the training registry must not be empty');
  assert.deepEqual([...standardTrainingFlow], expectedFlow);
  assert.deepEqual(Object.keys(trainingModuleManifests).sort(), [...ids].sort());
  assert.deepEqual(Object.keys(trainingModuleRegistry).sort(), [...ids].sort());

  for (const id of ids) {
    const flowEntry = trainingModuleFlowManifest[id];
    const registryEntry = trainingModuleRegistry[id];
    const generatedManifest = trainingModuleManifests[id];
    assert.ok(registryEntry, `registry entry is missing for ${id}`);
    assert.equal(registryEntry.manifest.id, id);
    assert.equal(generatedManifest.implementationVersion, trainingModuleImplementationVersion);
    assert.deepEqual([...generatedManifest.flow], expectedFlow);
    assert.equal(generatedManifest.lifecycle.owner, 'jspsych');
    assert.equal(registryEntry.sourcePath, flowEntry.sourcePath);
    assert.ok(
      existsSync(resolve(moduleRoot, ...flowEntry.sourcePath.split('/'))),
      `canonical module source is missing for ${id}: ${flowEntry.sourcePath}`,
    );

    if (flowEntry.jsPsychLifecycle === 'external-runtime-adapter') {
      assert.ok(
        knownLegacyAdapterIds.has(id),
        `new module ${id} cannot use the legacy lifecycle adapter; use native jsPsych`,
      );
    }

    const isInScope = id.startsWith('motor:')
      || id.startsWith('mouth:')
      || (id.startsWith('vision:') && !inScopeLifecycleExceptions.has(id))
      || id === 'brain:ufov';
    if (isInScope) {
      assert.equal(
        flowEntry.jsPsychLifecycle === 'native-timeline'
          || flowEntry.jsPsychLifecycle === 'external-runtime-adapter',
        true,
        `${id} must declare a jsPsych lifecycle mode`,
      );
    }
  }
});

test('module and runtime ownership stays directional and compatibility-only', () => {
  const contractsPackage = ReadJson('packages/training-contracts/package.json');
  const sdkPackage = ReadJson('packages/game-sdk/package.json');
  assert.deepEqual(contractsPackage.dependencies ?? {}, {});
  assert.deepEqual(contractsPackage.devDependencies ?? {}, {});
  assert.deepEqual(sdkPackage.dependencies ?? {}, {});
  assert.equal(contractsPackage.exports['.'].default, './src/index.js');
  assert.equal(sdkPackage.exports['.'].default, './src/index.js');

  const moduleFiles = CollectFiles(moduleRoot, /\.(?:ts|tsx)$/);
  for (const filePath of moduleFiles) {
    const source = readFileSync(filePath, 'utf8');
    if (!source.includes('training-runtimes')) continue;
    const compatibilityExport = source
      .replace(/\s+/g, ' ')
      .trim();
    assert.match(
      compatibilityExport,
      /^export \* from ['"](?:\.\.\/){2,3}training-runtimes\/(?:motor|vision|brain|mouth)\/src\/[A-Za-z0-9_./-]+['"];?$/,
      `${relative(repoRoot, filePath)} may only be a one-line compatibility re-export`,
    );
  }

  const runtimeRoot = resolve(repoRoot, 'apps/rehabtrainerhub/training-runtimes');
  for (const filePath of CollectFiles(runtimeRoot, /\.(?:ts|tsx)$/)) {
    const source = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      source,
      /from ['"](?:\.\.\/)+training-modules\//,
      `${relative(repoRoot, filePath)} must import module code through the hub-modules alias`,
    );
  }
});

test('official host remains light and owns the private lifecycle channel', async () => {
  const hostSource = Read('apps/rehabtrainerhub/app/official-training-host/OfficialTrainingHost.tsx');
  const protocolSource = Read('packages/ui/src/officialTrainingHostProtocol.ts');
  const policySource = Read('packages/ui/src/officialTrainingHostPolicy.ts');
  const overlaySource = Read('apps/rehabtrainerhub/app/train/TrainingOverlay.tsx');
  const routeSource = Read('apps/rehabtrainerhub/app/official-training-host/[domain]/[slug]/page.tsx');

  AssertNoHeavyStaticImport(hostSource, 'official host entry');
  AssertNoHeavyStaticImport(protocolSource, 'official host protocol');
  assert.match(hostSource, /MessagePort/);
  assert.match(hostSource, /IsTrainingHostConnect/);
  assert.match(hostSource, /ValidateTrainingEnvelope/);
  assert.match(hostSource, /sandbox=\{policy\.sandboxTokens\.join\(' '\)\}/);
  assert.match(protocolSource, /new MessageChannel\(\)/);
  assert.match(protocolSource, /sessionNonce/);
  assert.match(protocolSource, /sequence/);
  assert.match(protocolSource, /event\.source === iframe\.contentWindow/);
  assert.match(protocolSource, /port\.close\(\)/);
  assert.match(policySource, /sandboxTokens: readonly \['allow-scripts', 'allow-same-origin'\]/);
  assert.match(policySource, /officialTrainingHostRoutePrefix/);
  assert.match(policySource, /encodeURIComponent\(domain\)/);
  assert.match(policySource, /encodeURIComponent\(slug\)/);
  assert.match(overlaySource, /new OfficialTrainingHostSession/);
  assert.match(overlaySource, /CreateOfficialHostIframePolicy/);
  assert.doesNotMatch(overlaySource, /sandbox="allow-scripts"/);
  assert.match(routeSource, /export const dynamicParams = false/);
  assert.match(routeSource, /generateStaticParams/);
  assert.match(routeSource, /notFound\(\)/);

  const siteUrlsUrl = await CreateTranspiledDataUrl('packages/ui/src/siteUrls.ts');
  const policyModule = await LoadTypeScriptModule(
    'packages/ui/src/officialTrainingHostPolicy.ts',
    { './siteUrls': siteUrlsUrl },
  );
  const policy = policyModule.CreateOfficialHostIframePolicy({
    id: 'vision:oculomotor-training',
    capabilities: ['audio', 'camera', 'fullscreen', 'pointer'],
  }, { origin: 'https://example.test' });
  assert.deepEqual([...policy.sandboxTokens], ['allow-scripts', 'allow-same-origin']);
  assert.equal(
    policy.src,
    'https://example.test/official-training-host/vision/oculomotor-training/',
  );
  assert.equal(policy.featureAllowlist.autoplay, "'self'");
  assert.equal(policy.featureAllowlist.camera, "'self'");
  assert.equal(policy.featureAllowlist.microphone, "'none'");
  assert.equal(policy.featureAllowlist.fullscreen, "'self'");
  assert.equal(policy.featureAllowlist.gamepad, "'none'");
  assert.throws(
    () => policyModule.CreateOfficialHostIframePolicy(
      { id: 'vision:moving-card', capabilities: ['pointer'] },
      { origin: 'javascript:alert(1)' },
    ),
    /absolute HTTP\(S\) URL/,
  );
});

test('third-party games stay on the separate opaque sandbox boundary', () => {
  const runnerSource = Read('apps/usergamerunner/functions/[[path]].js');
  const rendererSource = Read('apps/usergamerunner/functions/_lib/render.js');
  const packageOverlaySource = Read('apps/rehabtrainerhub/app/train/PackageGameOverlay.tsx');
  const runnerConfig = Read('apps/usergamerunner/wrangler.toml');
  const releaseSource = Read('apps/usergamerunner/functions/_lib/release.js');
  const runtimeSource = Read('apps/usergamerunner/functions/_lib/runtime.js');
  const packageSource = Read('apps/rehabtrainerhub/functions/_lib/gamePackages.js');
  const sdkSource = Read('packages/game-sdk/src/index.js');

  assert.match(rendererSource, /sandbox="allow-scripts"/);
  assert.match(packageOverlaySource, /sandbox="allow-scripts"/);
  for (const source of [runnerSource, rendererSource, packageOverlaySource]) {
    assert.doesNotMatch(source, /allow-same-origin|allow-top-navigation/);
  }
  for (const directive of [
    "connect-src 'none'",
    "worker-src 'none'",
    "form-action 'none'",
    'frame-ancestors',
    'sandbox allow-scripts',
  ]) {
    assert.match(runnerSource, new RegExp(EscapeRegExp(directive)));
  }
  assert.match(runnerSource, /ParseEmbedOptions/);
  assert.match(rendererSource, /MessageChannel/);
  assert.match(rendererSource, /sessionNonce/);
  assert.match(releaseSource, /gamePlatformCapabilities/);
  assert.match(releaseSource, /value\.runtime\.name !== 'jspsych'/);
  assert.match(runtimeSource, /gamePlatformRuntimeContract/);
  assert.match(packageSource, /gamePlatformPackageLimits/);
  assert.match(packageSource, /gamePlatformRuntimeContract/);
  assert.doesNotMatch(sdkSource, /\b(?:fetch|XMLHttpRequest|WebSocket|RTCPeerConnection)\s*\(/);
  assert.match(runnerConfig, /binding = "GAME_RELEASE_BUCKET"/);
  assert.doesNotMatch(runnerConfig, /d1_databases|kv_namespaces/i);
  assert.equal((runnerConfig.match(/\[\[r2_buckets\]\]/g) ?? []).length, 1);
});

test('root and per-game PWA cache ownership remain separate', () => {
  const rootManifest = ReadJson('apps/rehabtrainerhub/public/manifest.webmanifest');
  const workerSource = Read('packages/ui/src/pwa-service-worker.js');
  const rootGeneratorSource = Read('scripts/emit-pwa-assets.mjs');
  const registrationSource = Read('packages/ui/src/pwa.tsx');
  const officialGeneratorSource = Read('scripts/emit-official-game-pwas.mjs');
  const runnerRendererSource = Read('apps/usergamerunner/functions/_lib/render.js');

  assert.equal(rootManifest.id, '/');
  assert.equal(rootManifest.scope, '/');
  for (const path of [
    '/runtimes/',
    '/games/',
    '/runtime-assets/',
    '/offline-manifests/',
    '/official-training-host/',
  ]) {
    assert.match(workerSource, new RegExp(`startsWith\\('${EscapeRegExp(path)}'\\)`));
    assert.match(rootGeneratorSource, new RegExp(EscapeRegExp(path.slice(1, -1))));
  }
  assert.match(registrationSource, /isStandaloneGamePath/);
  assert.match(registrationSource, /serviceWorker\.register\('\/sw\.js'/);
  assert.match(officialGeneratorSource, /BuildGameServiceWorker/);
  assert.match(officialGeneratorSource, /trainerhub-official-game/);
  assert.match(officialGeneratorSource, /data-official-game-pwa/);
  assert.match(runnerRendererSource, /manifest\.webmanifest/);
  assert.match(runnerRendererSource, /RenderServiceWorker/);
  assert.match(runnerRendererSource, /trainerhub-game:/);
});

test('game validation keeps scan, review, and publication gates independent', () => {
  const migrationSource = Read('apps/rehabtrainerhub/migrations/0010_game_validation_pipeline.sql');
  const stateSource = Read('apps/rehabtrainerhub/functions/_lib/gameValidationState.js');
  const intakeSource = Read('apps/rehabtrainerhub/functions/api/developer/games.js');
  const manualReviewSource = Read('apps/rehabtrainerhub/functions/api/developer/game-submissions/[id]/review.js');
  const adminValidationSource = Read('apps/rehabtrainerhub/functions/api/admin/game-submissions/[id]/review.js');
  const releaseReviewSource = Read('apps/rehabtrainerhub/functions/api/admin/game-releases/[id].js');
  const adminUiSource = Read('apps/rehabtrainerhub/app/admin/GameReleaseManager.tsx');

  for (const table of [
    'game_submissions',
    'game_submission_files',
    'game_scan_runs',
    'game_validation_findings',
    'game_review_requests',
  ]) {
    assert.match(migrationSource, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  for (const status of ['queued', 'running', 'passed', 'flagged', 'failed']) {
    assert.match(migrationSource, new RegExp(`'${status}'`));
  }
  for (const status of ['requested', 'in_review', 'changes_requested', 'approved', 'rejected']) {
    assert.match(migrationSource, new RegExp(`'${status}'`));
  }
  assert.match(migrationSource, /ALTER TABLE game_releases ADD COLUMN submission_id/);
  assert.match(stateSource, /scanTransitions/);
  assert.match(stateSource, /reviewTransitions/);
  assert.match(stateSource, /publicationTransitions/);
  for (const status of ['unpublished', 'publishing', 'published', 'revoked']) {
    assert.match(stateSource, new RegExp(`'${status}'`));
  }
  assert.match(stateSource, /hasHardBlock/);
  assert.match(stateSource, /scan === 'passed'/);
  assert.match(stateSource, /review === 'approved'/);
  assert.match(intakeSource, /gameValidationIntakePolicy/);
  assert.match(intakeSource, /INSERT INTO game_submissions/);
  assert.match(intakeSource, /INSERT INTO game_scan_runs/);
  assert.match(intakeSource, /INSERT INTO game_validation_findings/);
  assert.match(manualReviewSource, /CanRequestGameManualReview/);
  assert.match(manualReviewSource, /hard-block/);
  assert.match(adminValidationSource, /sourceReviewed/);
  assert.match(adminValidationSource, /playTested/);
  assert.match(adminValidationSource, /metadataReviewed/);
  assert.match(adminValidationSource, /hard-block/);
  assert.match(releaseReviewSource, /ClaimReleaseForPublishing/);
  assert.match(releaseReviewSource, /sourceReviewed/);
  assert.match(releaseReviewSource, /playTested/);
  assert.match(releaseReviewSource, /metadataReviewed/);
  assert.match(adminUiSource, /FetchAdminGameValidationQueue/);
  assert.match(adminUiSource, /sourceReviewed/);
  assert.match(adminUiSource, /playTested/);
  assert.match(adminUiSource, /metadataReviewed/);
});

test('pCloud installation policy stays explicit and link-free', () => {
  const rootPackage = ReadJson('package.json');
  const workspaceSource = Read('pnpm-workspace.yaml');
  const npmrcSource = Read('.npmrc');

  assert.match(rootPackage.packageManager, /^pnpm@11\.24\.0\+/);
  assert.equal(Object.hasOwn(rootPackage, 'workspaces'), false);
  assert.doesNotMatch(JSON.stringify(rootPackage.scripts), /\bnpm\s+(?:install|ci|run)\b/);
  assert.match(rootPackage.scripts['install:pcloud'], /prepare-pnpm-pcloud\.mjs/);
  assert.match(rootPackage.scripts['install:pcloud'], /corepack pnpm install --frozen-lockfile/);
  for (const setting of [
    'nodeLinker: hoisted',
    'packageImportMethod: copy',
    'injectWorkspacePackages: true',
    'dedupeInjectedDeps: false',
    'preferSymlinkedExecutables: false',
    'symlink: false',
  ]) {
    assert.match(workspaceSource, new RegExp(EscapeRegExp(setting)));
  }
  assert.doesNotMatch(npmrcSource, /^\s*(?:link-workspace-packages|prefer-workspace-packages)\s*=\s*true\s*$/m);
});

function Read(relativePath) {
  return readFileSync(resolve(repoRoot, ...relativePath.split('/')), 'utf8');
}

function ReadJson(relativePath) {
  return JSON.parse(Read(relativePath));
}

function CollectFiles(directory, filePattern) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...CollectFiles(filePath, filePattern));
    } else if (entry.isFile() && filePattern.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files;
}

function AssertNoHeavyStaticImport(source, label) {
  const imports = [
    ...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g),
    ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]).filter((specifier) => heavyPackagePattern.test(specifier));
  assert.deepEqual(imports, [], `${label} must not import a heavy engine: ${imports.join(', ')}`);
}

function EscapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

async function CreateTranspiledDataUrl(relativePath) {
  const source = Read(relativePath);
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
