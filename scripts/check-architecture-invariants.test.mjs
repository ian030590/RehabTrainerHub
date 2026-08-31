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
]);

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
    assert.ok(Array.isArray(flowEntry.runtimeAssetGroups));
    assert.ok(flowEntry.runtimeAssetGroups.every((group) => /^[a-z][a-z0-9-]{1,31}$/.test(group)));
    assert.equal(
      registryEntry.hostPath,
      `/official-training-host/${id.replace(':', '/')}/`,
      `host path must be generated for ${id}`,
    );
    if (id === 'vision:hart-chart') assert.equal(flowEntry.lifecycleExemption, 'hart-chart');
    if (id === 'vision:driving-rehab') assert.equal(flowEntry.lifecycleExemption, 'driving-simulation');
    const slug = id.slice(id.indexOf(':') + 1);
    assert.equal(registryEntry.officialPwa.scope, `/games/${slug}/`);
    assert.equal(registryEntry.officialPwa.manifestPath, `/games/${slug}/manifest.webmanifest`);
    assert.equal(registryEntry.officialPwa.serviceWorkerPath, `/games/${slug}/sw.js`);
    assert.equal(registryEntry.officialPwa.offlineManifestPathPrefix, `/offline-manifests/${slug}/`);
    assert.deepEqual([...registryEntry.recordAllowlist], [
      'schemaVersion',
      'moduleId',
      'moduleVersion',
      'status',
      'startedAt',
      'durationMs',
      'trialCount',
      'score',
      'metrics',
    ]);
    assert.deepEqual([...registryEntry.testIds], [
      `training-flow:${id}`,
      `training-lifecycle:${id}`,
      `official-pwa:${id}`,
    ]);
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

test('module ownership stays canonical and runtime compatibility stays directional', () => {
  const contractsPackage = ReadJson('packages/training-contracts/package.json');
  const sdkPackage = ReadJson('packages/game-sdk/package.json');
  const hubPackage = ReadJson('apps/rehabtrainerhub/package.json');
  assert.deepEqual(contractsPackage.dependencies ?? {}, {});
  assert.deepEqual(contractsPackage.devDependencies ?? {}, {});
  assert.deepEqual(sdkPackage.dependencies ?? {}, {});
  assert.equal(contractsPackage.exports['.'].default, './src/index.js');
  assert.equal(sdkPackage.exports['.'].default, './src/index.js');
  assert.equal(hubPackage.dependencies.acorn, '8.18.0');

  const moduleFiles = CollectFiles(moduleRoot, /\.(?:ts|tsx)$/);
  const moduleGraph = BuildLocalDependencyGraph(moduleFiles);
  assert.deepEqual(FindDependencyCycles(moduleGraph), [], 'training module source must not contain circular dependencies');
  for (const filePath of moduleFiles) {
    const source = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      source,
      /training-runtimes[\\/]/,
      `${relative(repoRoot, filePath)} must not depend on a category runtime; module source is canonical`,
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
  for (const [runtime, modulePath] of [
    ['motor', 'motor/utils/settings'],
    ['vision', 'vision/utils/settings'],
    ['brain', 'brain/utils/settings'],
    ['mouth', 'mouth/utils/settings'],
  ]) {
    const source = Read(`apps/rehabtrainerhub/training-runtimes/${runtime}/src/utils/settings.ts`);
    assert.match(
      source,
      new RegExp(`@rehab-trainer/hub-modules/${EscapeRegExp(modulePath)}`),
      `${runtime} runtime settings must delegate to module-owned settings`,
    );
  }
});

test('official host remains light and owns the private lifecycle channel', async () => {
  const hostSource = Read('apps/rehabtrainerhub/app/official-training-host/OfficialTrainingHost.tsx');
  const protocolSource = Read('packages/ui/src/officialTrainingHostProtocol.ts');
  const policySource = Read('packages/ui/src/officialTrainingHostPolicy.ts');
  const overlaySource = Read('apps/rehabtrainerhub/app/train/TrainingOverlay.tsx');
  const routeSource = Read('apps/rehabtrainerhub/app/official-training-host/[domain]/[slug]/page.tsx');
  const catalogSource = Read('apps/rehabtrainerhub/training-modules/catalog.ts');

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
  assert.match(overlaySource, /BuildTrainingModuleHref/);
  assert.match(catalogSource, /GetTrainingModuleRegistryEntry\(module\.catalogId\)\.hostPath/);
  assert.doesNotMatch(overlaySource, /sandbox="allow-scripts"/);
  assert.match(routeSource, /export const dynamicParams = false/);
  assert.match(routeSource, /generateStaticParams/);
  assert.match(routeSource, /notFound\(\)/);
  assert.match(routeSource, /BuildLegacyTrainingModuleHref/);
  assert.doesNotMatch(overlaySource, /BuildLegacyTrainingModuleHref/);

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
  const officialOutputCheckerSource = Read('scripts/check-official-game-pwa-output.mjs');
  const officialBrowserGateSource = Read('scripts/check-official-game-pwa-browser.mjs');
  const bundleBudgetSource = Read('scripts/check-bundle-budgets.mjs');
  const offlineManagerSource = Read('packages/ui/src/offlinePackManager.ts');
  const contractsSource = Read('packages/training-contracts/src/index.js');
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
  assert.match(officialGeneratorSource, /stagingCachePrefix/);
  assert.match(officialGeneratorSource, /caches\.open\(stagingCacheName\)/);
  assert.match(officialGeneratorSource, /caches\.delete\(stagingCacheName\)/);
  assert.match(officialGeneratorSource, /allowedRuntimePrefixes/);
  assert.match(officialGeneratorSource, /IsAllowedRuntimePath\(url\.pathname\)/);
  assert.match(contractsSource, /offlinePackLimitsValue/);
  assert.match(offlineManagerSource, /offlinePackLimits\.maximumResourceCount/);
  assert.match(offlineManagerSource, /offlinePackLimits\.maximumTotalBytes/);
  assert.match(officialGeneratorSource, /offlinePackLimits\.maximumResourceCount/);
  assert.match(officialGeneratorSource, /offlinePackLimits\.maximumTotalBytes/);
  assert.match(officialGeneratorSource, /url\.origin === self\.location\.origin[\s\S]{0,120}runtimeDestinations\.has/);
  assert.match(officialOutputCheckerSource, /ValidateOfflineResources/);
  assert.match(officialOutputCheckerSource, /ReadRuntimeAssetManifest/);
  assert.match(officialOutputCheckerSource, /same-origin output/);
  assert.match(officialBrowserGateSource, /import\('playwright'\)/);
  assert.match(officialBrowserGateSource, /serviceWorkers:\s*['"]allow['"]/);
  assert.match(officialBrowserGateSource, /IsHeavyUrl/);
  assert.match(officialBrowserGateSource, /OFFICIAL_GAME_PWA_BASE_URL/);
  assert.match(officialBrowserGateSource, /OFFICIAL_GAME_PWA_GAME_IDS/);
  assert.match(officialBrowserGateSource, /ParseGameIds/);
  assert.match(officialBrowserGateSource, /install-offline-pack|offlineButton\.click/);
  assert.match(officialBrowserGateSource, /context\.setOffline\(true\)/);
  assert.match(officialBrowserGateSource, /fresh page|fresh browser profile|offline launcher/i);
  assert.match(bundleBudgetSource, /maximumRootShellPrecacheBytes/);
  assert.match(bundleBudgetSource, /maximumShellPrecacheBytes/);
  assert.match(bundleBudgetSource, /--require-output/);
  assert.match(bundleBudgetSource, /offlinePackLimits\.maximumTotalBytes/);
  assert.match(offlineManagerSource, /MigrateLegacyOfflineCache/);
  assert.match(offlineManagerSource, /legacyOfflineCachePattern/);
  assert.match(runnerRendererSource, /manifest\.webmanifest/);
  assert.match(runnerRendererSource, /RenderServiceWorker/);
  assert.match(runnerRendererSource, /trainerhub-game:/);
});

test('platform runtime assets stay same-origin, allowlisted, and immutable', () => {
  const routeSource = Read('apps/rehabtrainerhub/functions/runtime-assets/[[path]].js');
  const generatorSource = Read('scripts/emit-official-game-pwas.mjs');
  const resolverSource = Read('packages/ui/src/aiAssets.ts');
  const webgazerLoaderSource = Read(
    'apps/rehabtrainerhub/training-modules/vision/utils/webgazerLoader.ts',
  );
  const cloudflareEnvSyncSource = Read('scripts/sync-cloudflare-auth-env.mjs');

  assert.match(routeSource, /ASSET_BUCKET/);
  assert.match(routeSource, /allowedKeyPattern/);
  assert.match(routeSource, /max-age=31536000, immutable/);
  assert.match(routeSource, /Cross-Origin-Resource-Policy/);
  assert.doesNotMatch(routeSource, /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*['"]/);
  assert.match(generatorSource, /ReadPlatformRuntimeAssets/);
  assert.match(generatorSource, /ReadFlowRuntimeAssetGroups/);
  assert.match(generatorSource, /BuildRuntimeAssetDescriptors/);
  assert.match(generatorSource, /runtimeAssetDescriptors/);
  assert.doesNotMatch(generatorSource, /switch\s*\(`\$\{trainer\}:\$\{game\.id\}`\)/);
  assert.match(Read('apps/rehabtrainerhub/training-modules/moduleFlowManifest.ts'), /runtimeAssetGroupsByCatalogId/);
  assert.match(resolverSource, /platformUrl/);
  assert.match(resolverSource, /IsSameOriginRelativeUrl/);
  assert.doesNotMatch(resolverSource, /normalizedBaseUrl\s*\?/);
  assert.match(webgazerLoaderSource, /runtime-assets\/ai\/webgazer/);
  assert.doesNotMatch(webgazerLoaderSource, /NormalizeHttpsUrl|assetBaseUrl\s*=|VITE_AI_ASSET_BASE_URL/);
  assert.doesNotMatch(cloudflareEnvSyncSource, /VITE_AI_ASSET_BASE_URL/);
  for (const filePath of CollectFiles(moduleRoot, /\.(?:ts|tsx)$/i)) {
    const source = readFileSync(filePath, 'utf8');
    assert.doesNotMatch(
      source,
      /\bVITE_AI_ASSET_BASE_URL\b/,
      `${relative(repoRoot, filePath).replaceAll('\\\\', '/')} must not build cross-origin runtime asset URLs`,
    );
  }
});

test('runtime asset resolver rejects arbitrary cross-origin fallbacks', async () => {
  const resolver = await LoadTypeScriptModule('packages/ui/src/aiAssets.ts');
  assert.deepEqual(
    resolver.CreateMediaPipeAssetUrls('https://cdn.example.invalid').wasmUrl,
    '/runtime-assets/ai/mediapipe/tasks-vision/0.10.35/wasm',
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      'https://cdn.example.invalid',
      'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      'https://cdn.example.invalid/star-sky.png',
    ),
    ['/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'],
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      'https://cdn.example.invalid',
      'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      '/runtimes/motor/assets/StarSky.png',
    ),
    ['/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'],
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      '/runtimes/motor/assets/StarSky.png',
    ),
    ['/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'],
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      '/runtimes/motor/assets/StarSky.png',
      { allowLocalFallback: true },
    ),
    [
      '/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      '/runtimes/motor/assets/StarSky.png',
    ],
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      '../secrets/model.task',
      '/runtimes/motor/assets/model.task',
      { allowLocalFallback: true },
    ),
    [],
  );
  assert.deepEqual(
    resolver.CreateRuntimeAssetUrlCandidates(
      'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
      '/runtimes/motor/../secret.png',
      { allowLocalFallback: true },
    ),
    ['/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'],
    'local fallbacks must not contain traversal segments',
  );

  const hadLocation = Object.hasOwn(globalThis, 'location');
  const previousLocation = globalThis.location;
  try {
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { protocol: 'https:', hostname: 'trainerhub.cc' },
    });
    assert.deepEqual(
      resolver.CreateRuntimeAssetUrlCandidates(
        'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
        '/runtimes/motor/assets/StarSky.png',
      ),
      ['/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png'],
      'production origins must not receive a local runtime fallback',
    );
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { protocol: 'http:', hostname: 'localhost' },
    });
    assert.deepEqual(
      resolver.CreateRuntimeAssetUrlCandidates(
        'game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
        '/runtimes/motor/assets/StarSky.png',
      ),
      [
        '/runtime-assets/game-assets/rehabtrainerhub/motor/star-sky/v1/StarSky.png',
        '/runtimes/motor/assets/StarSky.png',
      ],
      'localhost may use the local runtime fallback',
    );
  } finally {
    if (hadLocation) Object.defineProperty(globalThis, 'location', { configurable: true, value: previousLocation });
    else delete globalThis.location;
  }
});

test('game validation keeps scan, review, and publication gates independent', () => {
  const migrationSource = Read('apps/rehabtrainerhub/migrations/0010_game_validation_pipeline.sql');
  const attemptsMigrationSource = Read('apps/rehabtrainerhub/migrations/0011_game_submission_attempts.sql');
  const reportsMigrationSource = Read('apps/rehabtrainerhub/migrations/0012_game_scan_reports.sql');
  const platformReportsMigrationSource = Read('apps/rehabtrainerhub/migrations/0013_game_platform_reports.sql');
  const releaseMetadataMigrationSource = Read('apps/rehabtrainerhub/migrations/0014_game_release_metadata.sql');
  const stateSource = Read('apps/rehabtrainerhub/functions/_lib/gameValidationState.js');
  const queueSource = Read('apps/rehabtrainerhub/functions/_lib/gameValidationQueue.js');
  const controllerSource = Read('apps/rehabtrainerhub/functions/_lib/gameValidationController.js');
  const resultEndpointSource = Read('apps/rehabtrainerhub/functions/api/internal/game-validation-results.js');
  const maintenanceSource = Read('apps/rehabtrainerhub/functions/api/internal/game-platform-maintenance.js');
  const maintenanceLibrarySource = Read('apps/rehabtrainerhub/functions/_lib/gamePlatformMaintenance.js');
  const intakeSource = Read('apps/rehabtrainerhub/functions/api/developer/games.js');
  const manualReviewSource = Read('apps/rehabtrainerhub/functions/api/developer/game-submissions/[id]/review.js');
  const adminValidationSource = Read('apps/rehabtrainerhub/functions/api/admin/game-submissions/[id]/review.js');
  const releaseReviewSource = Read('apps/rehabtrainerhub/functions/api/admin/game-releases/[id].js');
  const adminReleaseListSource = Read('apps/rehabtrainerhub/functions/api/admin/game-releases.js');
  const sourceViewerSource = Read('apps/rehabtrainerhub/functions/api/admin/game-releases/[id]/source.js');
  const diffSource = Read('apps/rehabtrainerhub/functions/api/admin/game-releases/[id]/diff.js');
  const publicReportSource = Read('apps/rehabtrainerhub/functions/api/games/report.js');
  const adminReportSource = Read('apps/rehabtrainerhub/functions/api/admin/game-reports.js');
  const publicGamesSource = Read('apps/rehabtrainerhub/functions/api/games.js');
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
  assert.match(attemptsMigrationSource, /ALTER TABLE game_submissions ADD COLUMN attempt/);
  assert.match(attemptsMigrationSource, /idempotency_key/);
  assert.match(attemptsMigrationSource, /game_validation_overrides/);
  assert.match(attemptsMigrationSource, /game_platform_notifications/);
  assert.match(reportsMigrationSource, /game_scan_reports/);
  assert.match(platformReportsMigrationSource, /game_platform_reports/);
  assert.match(platformReportsMigrationSource, /copyright/);
  assert.match(releaseMetadataMigrationSource, /license_id/);
  assert.match(releaseMetadataMigrationSource, /not-declared/);
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
  assert.match(intakeSource, /ReadNextSubmissionAttempt/);
  assert.match(intakeSource, /idempotencyKey/);
  assert.match(queueSource, /ClaimGameValidationScanRun/);
  assert.match(queueSource, /ApplyGameScanReport/);
  assert.match(queueSource, /status = 'queued'/);
  assert.match(controllerSource, /quarantineAccess: 'read-only'/);
  assert.match(controllerSource, /CreateDisposableGameExecutor/);
  assert.match(controllerSource, /CreateEd25519ReportSigner/);
  assert.match(controllerSource, /artifact-hash-mismatch/);
  assert.doesNotMatch(controllerSource, /\.put\s*\(/);
  assert.doesNotMatch(controllerSource, /fetch\s*\(/);
  assert.match(resultEndpointSource, /IsGameValidationResultMessage/);
  assert.match(resultEndpointSource, /GAME_VALIDATION_RESULT_TOKEN/);
  assert.match(resultEndpointSource, /GAME_VALIDATION_ATTESTATION_KEYS_JSON/);
  assert.match(maintenanceSource, /GAME_MAINTENANCE_TOKEN/);
  assert.match(maintenanceSource, /ReconcileGamePlatformStorage/);
  assert.match(maintenanceLibrarySource, /protected_release\.status IN \('approved', 'publishing', 'revoked'\)/);
  assert.match(maintenanceLibrarySource, /game_platform_notifications/);
  assert.match(maintenanceLibrarySource, /ReconcileOrphanQuarantineObjects/);
  assert.match(maintenanceLibrarySource, /IsSafeQuarantineObjectKey/);
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
  assert.match(releaseReviewSource, /declared license/);
  assert.match(releaseReviewSource, /release\.scan_status !== 'passed'/);
  assert.match(adminReleaseListSource, /pending_scan\.status IN \('queued', 'running'\)/);
  assert.match(sourceViewerSource, /Content-Type': 'text\/plain/);
  assert.match(sourceViewerSource, /TextDecoder\('utf-8', \{ fatal: true \}\)/);
  assert.match(sourceViewerSource, /GAME_QUARANTINE_BUCKET/);
  assert.doesNotMatch(sourceViewerSource, /dangerouslySetInnerHTML|innerHTML/);
  assert.match(diffSource, /bounded, data-only diff/);
  assert.match(diffSource, /TextDecoder\('utf-8', \{ fatal: true \}\)/);
  assert.doesNotMatch(diffSource, /innerHTML|eval\s*\(/);
  assert.match(publicReportSource, /active_release_id/);
  assert.match(publicReportSource, /game-platform-report/);
  assert.match(publicGamesSource, /publisherType: 'third-party'/);
  assert.match(publicGamesSource, /resultTrust: 'client_reported'/);
  assert.match(publicGamesSource, /license_id/);
  assert.match(adminReportSource, /statusTransitions/);
  assert.match(adminReportSource, /CreateAdminAuditStatement/);
  assert.match(adminReportSource, /terminal report status/);
  assert.match(adminUiSource, /FetchAdminGameValidationQueue/);
  assert.match(adminUiSource, /sourceReviewed/);
  assert.match(adminUiSource, /playTested/);
  assert.match(adminUiSource, /metadataReviewed/);
  assert.match(adminUiSource, /FetchAdminGameReleaseSource/);
  assert.match(adminUiSource, /FetchAdminGameReleaseDiff/);
  assert.match(adminUiSource, /admin-game-diff-text/);
  assert.match(adminUiSource, /FetchAdminGameReports/);
  assert.match(adminUiSource, /UpdateAdminGameReport/);
  assert.match(adminUiSource, /admin-game-source-content/);
});

test('pnpm workspace policy uses the standard isolated linker', () => {
  const rootPackage = ReadJson('package.json');
  const workspaceSource = Read('pnpm-workspace.yaml');
  const npmrcSource = Read('.npmrc');
  const hubPackage = ReadJson('apps/rehabtrainerhub/package.json');
  const hubNextConfigSource = Read('apps/rehabtrainerhub/next.config.mjs');
  const hubNextTsconfig = ReadJson('apps/rehabtrainerhub/tsconfig.next.json');

  assert.match(rootPackage.packageManager, /^pnpm@11\.24\.0\+/);
  const nodeVersion = ReadNodeVersion();
  const nodeVersionMatch = /^v(\d+)\.(\d+)\.(\d+)$/.exec(nodeVersion);
  assert.ok(nodeVersionMatch, '.node-version must contain one exact vMAJOR.MINOR.PATCH value.');
  const [, nodeMajor, nodeMinor, nodePatch] = nodeVersionMatch;
  assert.equal(rootPackage.engines?.node, `>=${nodeMajor}.${nodeMinor}.${nodePatch} <${Number(nodeMajor) + 1}`);
  assert.equal(Object.hasOwn(rootPackage, 'workspaces'), false);
  assert.doesNotMatch(JSON.stringify(rootPackage.scripts), /\bnpm\s+(?:install|ci|run)\b/);
  for (const setting of [
    'nodeLinker: isolated',
    'packageImportMethod: auto',
    'preferSymlinkedExecutables: true',
    'symlink: true',
  ]) {
    assert.match(workspaceSource, new RegExp(EscapeRegExp(setting)));
  }
  for (const setting of [
    'nodeLinker: hoisted',
    'packageImportMethod: copy',
    'injectWorkspacePackages: true',
    'dedupeInjectedDeps: false',
    'preferSymlinkedExecutables: false',
    'symlink: false',
  ]) {
    assert.doesNotMatch(workspaceSource, new RegExp(EscapeRegExp(setting)));
  }
  assert.doesNotMatch(npmrcSource, /^\s*(?:link-workspace-packages|prefer-workspace-packages)\s*=\s*true\s*$/m);
  assert.match(
    hubPackage.scripts.prebuild,
    /tsc --noEmit --incremental false -p tsconfig\.json/,
    'Hub builds must run an explicit non-incremental type gate before Next.',
  );
  assert.match(
    hubPackage.scripts.build,
    /check-bundle-budgets\.mjs out|check-bundle-budgets\.mjs --require-output/,
    'Hub builds must run the generated bundle-budget gate.',
  );
  assert.match(hubNextConfigSource, /tsconfigPath:\s*['"]tsconfig\.next\.json['"]/);
  assert.equal(
    hubNextTsconfig.compilerOptions?.incremental,
    false,
    'Next must use a non-incremental tsconfig in production builds.',
  );
  assert.doesNotMatch(
    hubNextConfigSource,
    /ignoreBuildErrors\s*:/,
    'local filesystem compatibility must not suppress TypeScript diagnostics.',
  );
});

test('CI workflows pin third-party actions and provision the repository toolchain', () => {
  const rootPackage = ReadJson('package.json');
  assert.equal(
    rootPackage.scripts['test:training-integration'],
    'node scripts/check-training-integration.mjs',
    'the training integration contract must remain a first-class package script',
  );
  assert.match(
    rootPackage.scripts['test:training-lifecycle'],
    /check-component-training-engine\.mjs/,
    'the component training engine lifecycle contract must remain a first-class gate',
  );
  for (const scriptName of [
    'test:training-protocol',
    'test:bundle-budgets',
    'test:offline-packs',
    'test:game-review-security',
  ]) {
    assert.equal(typeof rootPackage.scripts[scriptName], 'string', `${scriptName} must remain executable.`);
  }
  for (const workflowPath of ['.github/workflows/ci.yml', '.github/workflows/deploy-cloudflare-pages.yml']) {
    const workflowSource = Read(workflowPath);
    const actionReferences = [...workflowSource.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#\s*(v\S+))?\s*$/gm)];
    assert.ok(actionReferences.length > 0, `${workflowPath} must declare at least one action`);
    for (const [, reference, versionComment] of actionReferences) {
      assert.match(
        reference,
        /^[^@]+@[0-9a-f]{40}$/,
        `${workflowPath} action ${reference} must use a full commit SHA`,
      );
      assert.match(versionComment ?? '', /^v\S+$/, `${workflowPath} action ${reference} must document its tag`);
    }
    assert.match(workflowSource, /pnpm\/action-setup@[0-9a-f]{40}[ \t]+# v4/);
    assert.doesNotMatch(
      workflowSource,
      /^\s+version:\s*11\.24\.0\s*$/m,
      `${workflowPath} must take pnpm's version from packageManager, not duplicate it in action inputs`,
    );
    assert.match(workflowSource, /actions\/setup-node@[0-9a-f]{40}[ \t]+# v6/);
    assert.match(workflowSource, /node-version-file:\s*\.node-version/);
    assert.match(workflowSource, /cache:\s*pnpm/);
    assert.doesNotMatch(
      workflowSource,
      /(?:VITE_)?AI_ASSET_BASE_URL/,
      `${workflowPath} must not inject a runtime asset base; platform assets are resolved through the same-origin route`,
    );
    assert.match(workflowSource, /actions\/checkout@[0-9a-f]{40}[ \t]+# v7/);
    assert.match(
      workflowSource,
      /name:\s*training-integration\s*\r?\n\s*command:\s*pnpm run test:training-integration/,
      `${workflowPath} must execute the training integration contract`,
    );
    for (const [name, command] of [
      ['training-protocol', 'test:training-protocol'],
      ['bundle-budgets', 'test:bundle-budgets'],
      ['offline-packs', 'test:offline-packs'],
      ['game-review-security', 'test:game-review-security'],
    ]) {
      assert.match(
        workflowSource,
        new RegExp(`name:\\s*${name}\\s*\\r?\\n\\s*command:\\s*pnpm run ${command}`),
        `${workflowPath} must execute ${command}`,
      );
    }
  }
});

function Read(relativePath) {
  return readFileSync(resolve(repoRoot, ...relativePath.split('/')), 'utf8');
}

function ReadJson(relativePath) {
  return JSON.parse(Read(relativePath));
}

function ReadNodeVersion() {
  const bytes = readFileSync(resolve(repoRoot, '.node-version'));
  assert.notDeepEqual(
    [...bytes.subarray(0, 2)],
    [0xff, 0xfe],
    '.node-version must be UTF-8; actions/setup-node does not decode UTF-16 BOM files.',
  );
  assert.equal(bytes.includes(0), false, '.node-version must not contain UTF-16 NUL bytes.');
  return bytes.toString('utf8').replace(/^\uFEFF/, '').trim();
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

function BuildLocalDependencyGraph(files) {
  const knownFiles = new Set(files.map((filePath) => NormalizePath(filePath)));
  const graph = new Map(files.map((filePath) => [NormalizePath(filePath), []]));
  for (const filePath of files) {
    const normalizedFile = NormalizePath(filePath);
    const source = readFileSync(filePath, 'utf8');
    const imports = [
      ...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/g),
    ].map((match) => match[1]).filter((specifier) => specifier.startsWith('.'));
    for (const specifier of imports) {
      const target = ResolveLocalModule(filePath, specifier, knownFiles);
      if (target) graph.get(normalizedFile).push(target);
    }
  }
  return graph;
}

function ResolveLocalModule(fromFile, specifier, knownFiles) {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.js'),
  ];
  return candidates.map(NormalizePath).find((candidate) => knownFiles.has(candidate)) ?? null;
}

function FindDependencyCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function Visit(node) {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      cycles.push([...stack.slice(start), node].map((filePath) => relative(repoRoot, filePath).replaceAll('\\\\', '/')));
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) Visit(dependency);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) Visit(node);
  return cycles;
}

function NormalizePath(filePath) {
  return resolve(filePath);
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
