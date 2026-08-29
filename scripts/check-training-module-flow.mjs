#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(repoRoot, 'apps/rehabtrainerhub/training-modules');
const catalogSource = readFileSync(resolve(moduleRoot, 'catalog.ts'), 'utf8');
const manifestSource = readFileSync(resolve(moduleRoot, 'moduleFlowManifest.ts'), 'utf8');
// The checker evaluates a transpiled module through a data URL. Rewrite the
// workspace package import to an absolute file URL because bare package
// specifiers have no package scope when their parent is a data URL.
const trainingContractsRuntimeUrl = pathToFileURL(
  resolve(repoRoot, 'packages/training-contracts/src/index.js'),
).href;
// The registry owns the route prefix through the UI policy module. The
// checker runs from a data URL, so provide the dependency-free exported value
// without teaching the checker a second module-resolution system.
const officialHostPolicyRuntimeUrl = `data:text/javascript;base64,${Buffer.from(
  "export const officialTrainingHostRoutePrefix = '/official-training-host';",
).toString('base64')}`;
const manifestExecutableSource = manifestSource.replace(
  /from ['"]@rehab-trainer\/training-contracts['"]/g,
  `from '${trainingContractsRuntimeUrl}'`,
).replace(
  /from ['"]@rehab-trainer\/ui\/officialTrainingHostPolicy['"]/g,
  `from '${officialHostPolicyRuntimeUrl}'`,
);
const manifestCode = ts.transpileModule(manifestExecutableSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const manifestUrl = `data:text/javascript;base64,${Buffer.from(manifestCode).toString('base64')}`;
const {
  standardTrainingFlow,
  trainingModuleFlowManifest,
  trainingModuleManifests,
  trainingModuleRegistry,
} = await import(manifestUrl);

const catalogIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((match) => `${match[2]}:${match[1]}`);
const catalogPurposes = new Map([...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)',\s*purpose:\s*'([^']+)'/g,
)].map((match) => [`${match[2]}:${match[1]}`, match[3]]));
const manifestIds = Object.keys(trainingModuleFlowManifest);

assert.equal(
  new Set(catalogIds).size,
  catalogIds.length,
  'Every Hub catalog ID must be unique.',
);
assert.deepEqual(
  [...manifestIds].sort(),
  [...catalogIds].sort(),
  'Every catalog module must have exactly one Hub-owned flow manifest.',
);
const generatedManifestIds = Object.keys(trainingModuleManifests);
assert.deepEqual(
  generatedManifestIds.sort(),
  [...catalogIds].sort(),
  'Generated module manifests must cover exactly the catalog modules.',
);
const generatedOrders = new Set();
for (const [catalogId, entry] of Object.entries(trainingModuleRegistry)) {
  assert.equal(entry.manifest.id, catalogId, `Generated manifest id must match ${catalogId}.`);
  assert.equal(
    entry.manifest.purposeId,
    catalogPurposes.get(catalogId),
    `Generated manifest purpose must match the catalog seed for ${catalogId}.`,
  );
  assert.equal(
    entry.manifest.purposeId,
    trainingModuleFlowManifest[catalogId].purposeId,
    `Flow and generated manifest purpose must match for ${catalogId}.`,
  );
  assert.equal(entry.sourcePath, trainingModuleFlowManifest[catalogId].sourcePath, `Generated source path must match ${catalogId}.`);
  assert.deepEqual(entry.manifest.flow, standardTrainingFlow, `Generated flow must be standard for ${catalogId}.`);
  assert.ok(!generatedOrders.has(entry.manifest.catalogOrder), `Generated catalogOrder must be unique for ${catalogId}.`);
  generatedOrders.add(entry.manifest.catalogOrder);
}
assert.equal(
  generatedOrders.size,
  catalogIds.length,
  'Generated module manifests must have unique catalogOrder values.',
);
for (const retiredCatalogId of ['brain:main-concept', 'brain:set-game', 'brain:sokoban']) {
  assert.ok(!catalogIds.includes(retiredCatalogId), `${retiredCatalogId} must remain fully retired from the catalog.`);
  assert.ok(!manifestIds.includes(retiredCatalogId), `${retiredCatalogId} must remain fully retired from the flow manifest.`);
}
for (const retiredPath of [
  'apps/rehabtrainerhub/training-modules/brain/pages/MainConceptTraining.tsx',
  'apps/rehabtrainerhub/public/assets/training-modules/main-concept.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/set-game.webp',
  'apps/rehabtrainerhub/public/assets/training-modules/sokoban.webp',
  'apps/rehabtrainerhub/training-runtimes/brain/public/assets/sokoban/player.png',
]) {
  assert.ok(!existsSync(resolve(repoRoot, retiredPath)), `Retired module file must stay deleted: ${retiredPath}`);
}

const themeRegistryBody = catalogSource.match(
  /export const trainingThemes = DefineTrainingThemes\(\{([\s\S]*?)\n\}\);/,
)?.[1] ?? '';
const themeIds = [...themeRegistryBody.matchAll(/^  (?:'([^']+)'|([A-Za-z][\w-]*)): \{/gm)]
  .map((match) => match[1] || match[2]);
const catalogPurposeIds = [...catalogSource.matchAll(/^    purpose: '([^']+)',/gm)]
  .map((match) => match[1]);

for (const requiredThemeId of [
  'upper-limb',
  'lower-limb',
  'vision',
  'attention',
  'memory',
  'higher-cognition',
  'language',
  'oral',
]) {
  assert.ok(
    themeIds.includes(requiredThemeId),
    `The catalog theme registry must preserve the built-in ${requiredThemeId} label.`,
  );
}
assert.ok(
  catalogPurposeIds.every((purposeId) => themeIds.includes(purposeId)),
  'Every catalog module purpose label must resolve through the single theme registry.',
);
for (const token of [
  'function DefineTrainingThemes',
  '[id, { ...theme, id }]',
  'export type TrainingPurposeId = keyof typeof trainingThemes',
  'export const trainingPurposes = Object.values(trainingThemes)',
  'Object.hasOwn(trainingThemes, purposeId)',
  'moduleOrPurposeId?.purpose',
  'if (!purposeId) return null',
  'return purposeId ? trainingThemes[purposeId] : defaultTrainingTheme',
]) {
  assert.ok(catalogSource.includes(token), `The catalog theme contract is missing "${token}".`);
}
for (const aliasToken of ["aliases: ['movement']", "aliases: ['general']"]) {
  assert.ok(
    themeRegistryBody.includes(aliasToken),
    `Published-game category alias must live in the theme registry: ${aliasToken}`,
  );
}

const lobbySource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/TrainingLobby.tsx'), 'utf8');
const progressSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx'), 'utf8');
const themeStyleSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/trainingThemeStyle.ts'), 'utf8');
const lobbyCssSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/globals.css'), 'utf8');
const developerPortalSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/developer/DeveloperPortal.tsx'), 'utf8');
const developerGamesApiSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/functions/api/developer/games.js'), 'utf8');
for (const [label, source] of [['lobby', lobbySource], ['progress', progressSource]]) {
  assert.ok(source.includes('GetTrainingModuleTheme'), `${label} cards must resolve their appearance from the theme registry.`);
  assert.ok(source.includes('BuildTrainingThemeStyle'), `${label} cards must inject the resolved theme as CSS variables.`);
  assert.ok(!source.includes('trainerVisuals'), `${label} must not keep a parallel trainer-specific visual registry.`);
}
assert.ok(themeStyleSource.includes("'--trainer-color'"), 'The shared theme style builder must inject theme CSS variables.');
assert.ok(!lobbySource.includes('publishedCategoryPurposes'), 'Published-game aliases must resolve from the single theme registry.');
assert.ok(lobbySource.includes('GetTrainingThemeId(game.category)'), 'Published-game filters and counts must resolve registry aliases.');
assert.ok(lobbySource.includes('TrainingThemeIcon decorative'), 'Published-game cards must render their registry-owned theme icon.');
assert.ok(lobbySource.includes('<TrainingThemeBadge'), 'Theme badges must have a shared lobby consumer.');
assert.ok(developerPortalSource.includes('categoryOptions = trainingPurposes.map'), 'Developer category options must derive from the theme registry.');
assert.ok(!developerPortalSource.includes("['general', '一般活動']"), 'Developer categories must not keep a parallel label registry.');
assert.ok(developerGamesApiSource.includes('categoryPattern.test(category)'), 'The upload API must accept future bounded theme IDs.');
assert.ok(!developerGamesApiSource.includes('allowedCategories'), 'The upload API must not keep a parallel theme whitelist.');
for (const retiredSelector of ['trainer-motor', 'trainer-vision', 'trainer-brain', 'trainer-mouth']) {
  assert.ok(!lobbyCssSource.includes(retiredSelector), `Lobby CSS must not depend on .${retiredSelector}.`);
}

const configReadyHookSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/hooks/useTrainingConfigReady.ts'),
  'utf8',
);
const loginReminderSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/components/TrainingLoginReminder.tsx'),
  'utf8',
);
const authClientSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/auth/authClient.ts'),
  'utf8',
);
const authPanelSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/components/AuthPanel.tsx'),
  'utf8',
);
const visionRuntimeAppSource = readFileSync(
  resolve(repoRoot, 'apps/rehabtrainerhub/training-runtimes/vision/src/App.tsx'),
  'utf8',
);
for (const token of [
  'trainingConfigReadyEvent',
  'window.dispatchEvent(new CustomEvent(trainingConfigReadyEvent))',
]) {
  assert.ok(configReadyHookSource.includes(token), `Training config readiness must emit "${token}".`);
}
assert.ok(
  visionRuntimeAppSource.includes("const isTrainingPath = [\n    '/',"),
  'Vision must keep the login reminder active on the root module-config route.',
);
for (const token of [
  'window.addEventListener(trainingConfigReadyEvent',
  'setIsReminderOpen(true)',
  'setIsCheckingSession(Boolean(GetAuthToken()))',
  'checkSession(true)',
  'sessionCheckAbortRef.current?.abort()',
  'sessionCheckTimeoutMs',
  'FetchCurrentAuthUser(apiBase, controller.signal)',
  'FetchSharedAuthSession(apiBase, controller.signal)',
  '(isSignedIn && !isCheckingSession)',
  'else if (openForGuest) setIsReminderOpen(true)',
]) {
  assert.ok(loginReminderSource.includes(token), `The per-training guest reminder is missing "${token}".`);
}
for (const token of ['signal?: AbortSignal', 'signal,']) {
  assert.ok(authClientSource.includes(token), `Auth session requests must be abortable: ${token}`);
}
for (const token of [
  'loadUserGenerationRef',
  'loadUserAbortRef.current?.abort()',
  'FetchCurrentAuthUser(apiBase, controller.signal)',
  'FetchSharedAuthSession(apiBase, controller.signal)',
  'generation !== loadUserGenerationRef.current',
]) {
  assert.ok(authPanelSource.includes(token), `Auth panel stale-session guard is missing "${token}".`);
}

const minesweeperSource = readFileSync(
  resolve(moduleRoot, 'brain/pages/thinking/MinesweeperGame.tsx'),
  'utf8',
);
for (const size of ['6x6', '16x16', '20x20']) {
  assert.ok(minesweeperSource.includes(`label: '${size}'`), `Minesweeper must retain the ${size} preset.`);
}
for (const retiredOption of ['customBoardSize', "label: '9x9'", "label: '16x30'", "label: '80x80'"]) {
  assert.ok(!minesweeperSource.includes(retiredOption), `Minesweeper must remove ${retiredOption}.`);
}
for (const zoomToken of ['handleCanvasWheel', 'pinchStartRef', 'minBoardZoom', 'maxBoardZoom', 'minesweeper.zoom.reset']) {
  assert.ok(minesweeperSource.includes(zoomToken), `Minesweeper responsive zoom is missing "${zoomToken}".`);
}

const cognitiveUtilsSource = readFileSync(
  resolve(moduleRoot, 'brain/pages/thinking/cognitive/utils.ts'),
  'utf8',
);
assert.ok(cognitiveUtilsSource.includes('cognitiveBoardWidthRatio = 0.75'), 'Cognitive boards must use at most 75% of viewport width.');
assert.ok(cognitiveUtilsSource.includes('cognitiveBoardHeightRatio = 1'), 'Cognitive boards must use at most 100% of viewport height.');

const languageNeutralSource = readFileSync(
  resolve(moduleRoot, 'brain/pages/thinking/cognitive/languageNeutralGames.ts'),
  'utf8',
);
assert.ok(languageNeutralSource.includes('const aiTurnDelaySeconds = 1'), 'Board-game opponents must wait one second.');
for (const game of ['TicTacToe', 'Connect4', 'DotsAndBoxes', 'Hex']) {
  assert.ok(languageNeutralSource.includes(`Take${game}AiTurn`), `${game} must defer its computer move through the timed update loop.`);
}

const referenceCognitiveSource = readFileSync(
  resolve(moduleRoot, 'brain/pages/thinking/ReferenceCognitiveGame.tsx'),
  'utf8',
);
const mobileControlsSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/components/MobileTouchControls.tsx'),
  'utf8',
);
assert.ok(referenceCognitiveSource.includes("stateRef.current?.kind === 'maze'"), 'Maze must expose touch direction controls while playing.');
assert.ok(!referenceCognitiveSource.includes("stateRef.current?.kind === 'sokoban'"), 'Retired Sokoban controls must not remain.');
assert.ok(mobileControlsSource.includes('<svg'), 'Mobile direction controls must use SVG icons.');
assert.ok(!mobileControlsSource.includes("up: '↑'"), 'Mobile direction controls must not use arrow glyphs or emoji.');

for (const catalogId of catalogIds) {
  const manifest = trainingModuleFlowManifest[catalogId];
  assert.deepEqual(
    manifest.flow,
    standardTrainingFlow,
    `${catalogId} must follow card -> config -> rules -> training -> results.`,
  );
  assert.ok(
    ['none', 'camera', 'camera-optional', 'camera-or-microphone'].includes(
      manifest.mediaPermission,
    ),
    `${catalogId} has an invalid media-permission contract.`,
  );
  assert.ok(
    existsSync(resolve(moduleRoot, manifest.sourcePath)),
    `${catalogId} canonical Hub module source is missing: ${manifest.sourcePath}`,
  );
}

const hostImports = {
  motor: '@rehab-trainer/hub-modules/motor/',
  vision: '@rehab-trainer/hub-modules/vision/',
  brain: '@rehab-trainer/hub-modules/brain/',
  mouth: '@rehab-trainer/hub-modules/mouth/',
};

for (const [trainer, expectedImport] of Object.entries(hostImports)) {
  const appSource = readFileSync(resolve(repoRoot, `apps/rehabtrainerhub/training-runtimes/${trainer}/src/App.tsx`), 'utf8');
  assert.ok(
    appSource.includes(expectedImport),
    `${trainer} runtime must load its canonical module from the Hub namespace.`,
  );
}

const implementationGroups = [
  {
    ids: ['motor:drawing-defense'],
    files: ['motor/pages/training/DrawingTowerDefenseGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:asteroid-shield'],
    files: ['motor/pages/training/AsteroidShieldGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:gesture-battler'],
    files: ['motor/pages/training/GestureBattlerGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('combat')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:motor-cortex-rehab'],
    files: ['motor/pages/training/MotorCortexRehabGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: [
      'vision:moving-card',
      'vision:oculomotor-training',
      'vision:gabor-patching',
      'vision:reading-training',
      'vision:driving-rehab',
    ],
    files: [
      'vision/pages/HomePage.tsx',
      'vision/pages/training/TrainingPage.tsx',
      'vision/pages/training/results/TrainingResults.tsx',
    ],
    tokens: [
      'setExpandedModule(',
      'setRulesModule(expandedModule)',
      'trainingFlowLaunchState',
      'IsTrainingFlowLaunchState',
      "setPhase('results')",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['vision:hart-chart'],
    files: [
      'vision/pages/HomePage.tsx',
      'vision/pages/training/HartChartPage.tsx',
    ],
    tokens: [
      'setExpandedModule(',
      'setRulesModule(expandedModule)',
      'trainingFlowLaunchState',
      'IsTrainingFlowLaunchState',
      "setPhase('results')",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['brain:ufov'],
    files: [
      'brain/pages/ModulePage.tsx',
      'brain/pages/PeripheralAttentionPage.tsx',
      'brain/pages/peripheral-attention/PeripheralAttentionPage.tsx',
    ],
    tokens: [
      'setIsUfovConfigOpen(true)',
      'setIsUfovRulesOpen(true)',
      'trainingFlowLaunchState',
      'IsTrainingFlowLaunchState',
      'TrainingRulesPanel',
      'TrainingResultActions',
    ],
  },
  {
    ids: ['brain:every-ball-response'],
    files: ['brain/pages/EveryBallResponsePage.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['brain:minesweeper'],
    files: ['brain/pages/thinking/MinesweeperGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ReferenceCognitiveCatalogIds(),
    files: ['brain/pages/thinking/ReferenceCognitiveGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['mouth:tongue-catch'],
    files: ['mouth/pages/training/TongueCatchGame.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
];

const implementationIds = implementationGroups.flatMap(({ ids }) => ids);
assert.deepEqual(
  [...implementationIds].sort(),
  [...catalogIds].sort(),
  'Every catalog module must be covered by exactly one executable flow implementation check.',
);

for (const { files, ids, tokens } of implementationGroups) {
  const source = files.map((file) => (
    readFileSync(resolve(moduleRoot, file), 'utf8')
  )).join('\n');
  for (const token of tokens) {
    assert.ok(
      source.includes(token),
      `${ids.join(', ')} is missing executable flow evidence "${token}".`,
    );
  }
}

const externalRuntimeAdapterTokens = [
  'initJsPsych(',
  'new JsPsychExternalLifecycle(',
  'jsPsychLifecycleRef.current?.start({',
  'jsPsychLifecycleRef.current?.finish(',
  'jsPsychLifecycleRef.current?.abort({',
  'lifecycle.dispose()',
];

const jsPsychLifecycleGroups = [
  {
    status: 'native-timeline',
    ids: ['motor:drawing-defense'],
    files: [
      'motor/pages/training/DrawingTowerDefenseGame.tsx',
      'motor/experiment/plugins/drawing-defense-lifecycle.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run([', 'DrawingDefensePlugin', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['motor:gesture-battler'],
    files: [
      'motor/pages/training/GestureBattlerGame.tsx',
      'motor/experiment/plugins/gesture-battler-lifecycle.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run([', 'GestureBattlerPlugin', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['motor:motor-cortex-rehab'],
    files: [
      'motor/pages/training/MotorCortexRehabGame.tsx',
      'motor/experiment/plugins/motor-cortex-rehab-lifecycle.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run([', 'MotorCortexRehabPlugin', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['motor:asteroid-shield'],
    files: [
      'motor/pages/training/AsteroidShieldGame.tsx',
      'motor/experiment/plugins/asteroid-shield-lifecycle.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run([', 'AsteroidShieldPlugin', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['mouth:tongue-catch'],
    files: [
      'mouth/pages/training/TongueCatchGame.tsx',
      'mouth/experiment/plugins/tongue-catch-lifecycle.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run([', 'TongueCatchPlugin', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: [
      'vision:moving-card',
      'vision:oculomotor-training',
      'vision:gabor-patching',
      'vision:reading-training',
      'vision:driving-rehab',
    ],
    files: [
      'vision/pages/training/TrainingPage.tsx',
      'vision/experiment/plugins/pixi-moving-card.ts',
      'vision/experiment/plugins/pixi-oculomotor-training.ts',
      'vision/experiment/plugins/pixi-gabor-patching.ts',
      'vision/experiment/plugins/pixi-reading-training.ts',
      'vision/experiment/plugins/three-driving-rehab.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['brain:ufov'],
    files: ['brain/pages/peripheral-attention/PeripheralAttentionPage.tsx'],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['brain:every-ball-response'],
    files: ['brain/pages/EveryBallResponsePage.tsx'],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'external-runtime-adapter',
    ids: ['vision:hart-chart'],
    files: ['vision/pages/training/HartChartPage.tsx'],
    tokens: [
      'initJsPsych(',
      'new JsPsychExternalLifecycle(',
      'lifecycle.start({',
      'jsPsychLifecycleRef.current?.finish({',
      'jsPsychLifecycleRef.current?.abort({',
      'lifecycle.dispose()',
    ],
    forbiddenTokens: ['WriteJsPsychData'],
  },
  {
    status: 'external-runtime-adapter',
    ids: ReferenceCognitiveCatalogIds(),
    files: ['brain/pages/thinking/ReferenceCognitiveGame.tsx'],
    tokens: [
      'initJsPsych(',
      'new JsPsychExternalLifecycle(',
      'jsPsychLifecycleRef.current?.start({',
      'jsPsychLifecycleRef.current?.finish(',
      'jsPsychLifecycleRef.current?.abort({',
      'lifecycle.dispose()',
    ],
    forbiddenTokens: ['WriteJsPsychData'],
  },
  ...Object.entries({
    'brain:minesweeper': 'brain/pages/thinking/MinesweeperGame.tsx',
  }).map(([id, file]) => ({
    status: 'external-runtime-adapter',
    ids: [id],
    files: [file],
    tokens: externalRuntimeAdapterTokens,
    forbiddenTokens: ['WriteJsPsychData'],
  })),
];

const jsPsychLifecycleIds = jsPsychLifecycleGroups.flatMap(({ ids }) => ids);
assert.deepEqual(
  [...jsPsychLifecycleIds].sort(),
  [...catalogIds].sort(),
  'Every catalog module must have exactly one explicit jsPsych lifecycle classification.',
);

const manifestLifecycleValues = new Set(['native-timeline', 'external-runtime-adapter']);
for (const catalogId of catalogIds) {
  const lifecycle = trainingModuleFlowManifest[catalogId].jsPsychLifecycle;
  assert.ok(
    manifestLifecycleValues.has(lifecycle),
    `${catalogId} must declare a valid jsPsych lifecycle in the flow manifest.`,
  );
  const expectedLifecycle = jsPsychLifecycleGroups.find(({ ids }) => ids.includes(catalogId))?.status;
  assert.equal(
    lifecycle,
    expectedLifecycle,
    `${catalogId} flow manifest lifecycle must match its executable lifecycle evidence.`,
  );
}

for (const { files, forbiddenTokens = [], ids, status, tokens } of jsPsychLifecycleGroups) {
  const source = files.map((file) => (
    readFileSync(resolve(moduleRoot, file), 'utf8')
  )).join('\n');
  for (const token of tokens) {
    assert.ok(
      source.includes(token),
      `${ids.join(', ')} is missing ${status} jsPsych evidence "${token}".`,
    );
  }
  for (const token of forbiddenTokens) {
    assert.ok(
      !source.includes(token),
      `${ids.join(', ')} lifecycle status is stale because it now contains "${token}".`,
    );
  }
}

const externalLifecycleAdapterSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/jsPsychLifecycle.ts'),
  'utf8',
);
for (const token of [
  'implements JsPsychPlugin',
  'this.jsPsych.run([',
  'this.jsPsych.finishTrial(',
  'this.jsPsych.abortExperiment(',
  'this.jsPsych.pluginAPI.clearAllTimeouts()',
]) {
  assert.ok(
    externalLifecycleAdapterSource.includes(token),
    `The renderer-independent jsPsych lifecycle adapter is missing "${token}".`,
  );
}

const pendingJsPsychIds = jsPsychLifecycleGroups
  .filter(({ status }) => status === 'utility-only-pending')
  .flatMap(({ ids }) => ids);

const configPermissionImplementations = {
  'motor:asteroid-shield': 'motor/pages/training/AsteroidShieldGame.tsx',
  'motor:gesture-battler': 'motor/pages/training/GestureBattlerGame.tsx',
  'motor:motor-cortex-rehab': 'motor/pages/training/MotorCortexRehabGame.tsx',
  'brain:every-ball-response': 'brain/pages/EveryBallResponsePage.tsx',
  'mouth:tongue-catch': 'mouth/pages/training/TongueCatchGame.tsx',
};
const nativeTimelinePermissionImplementations = {
  'vision:oculomotor-training': resolve(
    repoRoot,
    'apps/rehabtrainerhub/training-modules/vision/utils/webgazerCalibration.ts',
  ),
};
const permissionModuleIds = catalogIds.filter((catalogId) => (
  trainingModuleFlowManifest[catalogId].mediaPermission !== 'none'
));
assert.deepEqual(
  permissionModuleIds.sort(),
  [
    ...Object.keys(configPermissionImplementations),
    ...Object.keys(nativeTimelinePermissionImplementations),
  ].sort(),
  'The media-permission manifest must match the modules that request camera or microphone access.',
);
for (const [catalogId, file] of Object.entries(configPermissionImplementations)) {
  const source = readFileSync(resolve(moduleRoot, file), 'utf8');
  assert.ok(
    source.includes('useMediaPermissionPreflight'),
    `${catalogId} must request its camera or microphone permission during config.`,
  );
  assert.ok(
    source.includes('.retry'),
    `${catalogId} must offer a permission retry after denial or failure.`,
  );
}
for (const [catalogId, file] of Object.entries(nativeTimelinePermissionImplementations)) {
  const source = readFileSync(file, 'utf8');
  assert.ok(
    source.includes("from '@jspsych/plugin-webgazer-init-camera'")
      && source.includes('type: WebGazerInitCameraPlugin'),
    `${catalogId} must request camera permission through its native jsPsych init_camera trial.`,
  );
}

const turboConfig = JSON.parse(readFileSync(resolve(repoRoot, 'turbo.json'), 'utf8'));
assert.ok(
  turboConfig.globalDependencies?.includes('apps/rehabtrainerhub/training-modules/**'),
  'Turbo must invalidate Trainer builds when canonical Hub module sources change.',
);

console.log(
  `Training flow contract passed for ${catalogIds.length} Hub-owned modules, ${implementationGroups.length} runtime flows, and ${Object.keys(hostImports).length} Hub runtimes.`,
);
console.log(
  pendingJsPsychIds.length > 0
    ? `jsPsych lifecycle: ${catalogIds.length - pendingJsPsychIds.length} managed by native timelines/adapters; ${pendingJsPsychIds.length} still utility-only (${pendingJsPsychIds.join(', ')}).`
    : `jsPsych lifecycle: all ${catalogIds.length} modules are managed by native timelines or external-runtime adapters; none remain utility-only.`,
);

function ReferenceCognitiveCatalogIds() {
  return [
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
  ];
}
