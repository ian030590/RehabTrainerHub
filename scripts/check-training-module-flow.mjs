#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(repoRoot, 'apps/rehabtrainerhub/games');
const catalogSource = readFileSync(resolve(moduleRoot, 'catalog.ts'), 'utf8');
const gameTagsSource = readFileSync(resolve(moduleRoot, 'gameTags.js'), 'utf8');
const manifestSource = readFileSync(resolve(moduleRoot, 'moduleFlowManifest.ts'), 'utf8');
const manifestCode = ts.transpileModule(manifestSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const manifestUrl = `data:text/javascript;base64,${Buffer.from(manifestCode).toString('base64')}`;
const {
  standardTrainingFlow,
  tourTrainingFlow,
  trainingModuleFlowManifest,
} = await import(manifestUrl);

const expFactoryGameFiles = Object.freeze({
  'brain:stroop': 'stroop/StroopGame.tsx',
  'brain:flanker': 'flanker/FlankerGame.tsx',
  'brain:go-nogo': 'go-nogo/GoNoGoGame.tsx',
  'brain:stop-signal': 'stop-signal/StopSignalGame.tsx',
  'brain:attention-network-task': 'attention-network-task/AttentionNetworkTaskGame.tsx',
  'brain:antisaccade': 'antisaccade/AntisaccadeGame.tsx',
  'brain:n-back': 'n-back/NBackGame.tsx',
  'brain:digit-span': 'digit-span/DigitSpanGame.tsx',
  'brain:spatial-span': 'spatial-span/SpatialSpanGame.tsx',
  'brain:letter-memory': 'letter-memory/LetterMemoryGame.tsx',
  'brain:keep-track': 'keep-track/KeepTrackGame.tsx',
  'brain:tower-of-london': 'tower-of-london/TowerOfLondonGame.tsx',
  'brain:number-letter': 'number-letter/NumberLetterGame.tsx',
  'brain:plus-minus': 'plus-minus/PlusMinusGame.tsx',
});
const expFactoryCatalogIds = Object.keys(expFactoryGameFiles);

const catalogIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((match) => `${match[2]}:${match[1]}`);
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
assert.ok(developerPortalSource.includes('trainerCategoryTags.map'), 'Developer uploads must require a registry-owned major category tag.');
assert.ok(developerPortalSource.includes('.filter((option) => option.trainer === trainer)'), 'Developer filter tags must stay compatible with the selected major category.');
assert.ok(!developerPortalSource.includes("['general', '一般活動']"), 'Developer categories must not keep a parallel label registry.');
assert.ok(developerGamesApiSource.includes('IsGameTagPair(trainer, category)'), 'The upload API must validate both registry-owned game tags.');
for (const trainerId of ['motor', 'mouth', 'brain', 'vision']) {
  assert.ok(gameTagsSource.includes(`id: '${trainerId}'`), `The shared tag registry is missing ${trainerId}.`);
}
assert.ok(gameTagsSource.includes("'upper-limb': 'motor'"), 'Filter options must map to a compatible major category.');
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
// training-runtimes retired
for (const token of [
  'trainingConfigReadyEvent',
  'window.dispatchEvent(new CustomEvent(trainingConfigReadyEvent))',
]) {
  assert.ok(configReadyHookSource.includes(token), `Training config readiness must emit "${token}".`);
}
// vision login reminder checked via embedded training overlay
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
  resolve(moduleRoot, 'minesweeper/MinesweeperGame.tsx'),
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
  resolve(moduleRoot, 'maze/runtime/cognitive/utils.ts'),
  'utf8',
);
assert.ok(cognitiveUtilsSource.includes('cognitiveBoardWidthRatio = 0.75'), 'Cognitive boards must use at most 75% of viewport width.');
assert.ok(cognitiveUtilsSource.includes('cognitiveBoardHeightRatio = 1'), 'Cognitive boards must use at most 100% of viewport height.');

const languageNeutralSource = ['tic-tac-toe', 'connect4', 'dots-and-boxes', 'hex'].map((id) => readFileSync(
  resolve(moduleRoot, `${id}/runtime/cognitive/languageNeutralGames.ts`), 'utf8',
)).join('\n');
assert.ok(languageNeutralSource.includes('const aiTurnDelaySeconds = 1'), 'Board-game opponents must wait one second.');
for (const game of ['TicTacToe', 'Connect4', 'DotsAndBoxes', 'Hex']) {
  assert.ok(languageNeutralSource.includes(`Take${game}AiTurn`), `${game} must defer its computer move through the timed update loop.`);
}

const referenceCognitiveSource = readFileSync(
  resolve(moduleRoot, 'maze/runtime/cognitive/ReferenceCognitiveGame.tsx'),
  'utf8',
);
const mobileControlsSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/components/MobileTouchControls.tsx'),
  'utf8',
);
assert.ok(referenceCognitiveSource.includes('MobileTouchControls'), 'Maze must expose touch direction controls while playing.');
assert.ok(!referenceCognitiveSource.includes("stateRef.current?.kind === 'sokoban'"), 'Retired Sokoban controls must not remain.');
assert.ok(mobileControlsSource.includes('<svg'), 'Mobile direction controls must use SVG icons.');
assert.ok(!mobileControlsSource.includes("up: '↑'"), 'Mobile direction controls must not use arrow glyphs or emoji.');

for (const catalogId of catalogIds) {
  const manifest = trainingModuleFlowManifest[catalogId];
  const expectedFlow = expFactoryCatalogIds.includes(catalogId)
    ? tourTrainingFlow
    : standardTrainingFlow;
  assert.deepEqual(
    manifest.flow,
    expectedFlow,
    `${catalogId} has a stale card-to-results flow.`,
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

assert.ok(!existsSync(resolve(repoRoot, 'apps/rehabtrainerhub/training-modules')), 'training-modules must be deleted.');
assert.ok(!existsSync(resolve(repoRoot, 'apps/rehabtrainerhub/training-runtimes')), 'training-runtimes must be deleted.');

const implementationGroups = [
  {
    ids: ['motor:drawing-defense'],
    files: ['drawing-defense/DrawingTowerDefenseGame.tsx'],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:asteroid-shield'],
    files: ['asteroid-shield/AsteroidShieldGame.tsx'],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:gesture-battler'],
    files: ['gesture-battler/GestureBattlerGame.tsx'],
    tokens: [
      "('rules')",
      "setPhase('combat')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['motor:motor-cortex-rehab'],
    files: ['motor-cortex-rehab/MotorCortexRehabGame.tsx'],
    tokens: [
      "('rules')",
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
      'moving-card/MovingCardGame.tsx',
      'oculomotor-training/OculomotorTrainingGame.tsx',
      'gabor-patching/GaborPatchingGame.tsx',
      'reading-training/ReadingTrainingGame.tsx',
      'driving-rehab/DrivingRehabGame.tsx',
    ],
    tokens: [
      'IsTrainingFlowLaunchState',
      "setPhase('results')",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['vision:hart-chart'],
    files: [
      'hart-chart/HartChartPage.tsx',
    ],
    tokens: [
      'IsTrainingFlowLaunchState',
      "setPhase('results')",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['brain:ufov'],
    files: [
      'ufov/PeripheralAttentionPage.tsx',
    ],
    tokens: [
      'finishExperiment',
      'setResults(',
      'PeripheralAttentionExperimentPlugin',
    ],
  },
  {
    ids: ['brain:every-ball-response'],
    files: ['every-ball-response/EveryBallResponsePage.tsx'],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  {
    ids: ['brain:minesweeper'],
    files: ['minesweeper/MinesweeperGame.tsx'],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  },
  ...Object.entries(expFactoryGameFiles).map(([id, file]) => ({
    ids: [id],
    files: [file],
    tokens: ['ExpFactoryGame', 'sourceCommit:'],
  })),
  ...ReferenceCognitiveCatalogIds().map(id => ({
    ids: [id],
    files: [resolve(moduleRoot, id.split(':')[1], 'runtime/cognitive/ReferenceCognitiveGame.tsx')],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'TrainingResultActions',
    ],
  })),
  {
    ids: ['mouth:tongue-catch'],
    files: ['tongue-catch/TongueCatchGame.tsx'],
    tokens: [
      "('rules')",
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
    ids: [
      'vision:moving-card',
      'vision:oculomotor-training',
      'vision:gabor-patching',
      'vision:reading-training',
      'vision:driving-rehab',
    ],
    files: [
      'oculomotor-training/OculomotorTrainingGame.tsx',
      'moving-card/pixi-moving-card.ts',
      'oculomotor-training/pixi-oculomotor-training.ts',
      'gabor-patching/pixi-gabor-patching.ts',
      'reading-training/pixi-reading-training.ts',
      'driving-rehab/three-driving-rehab.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['brain:ufov'],
    files: ['ufov/PeripheralAttentionPage.tsx'],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['brain:every-ball-response'],
    files: ['every-ball-response/EveryBallResponsePage.tsx'],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'external-runtime-adapter',
    ids: ['vision:hart-chart'],
    files: ['hart-chart/HartChartPage.tsx'],
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
    files: [resolve(moduleRoot, 'maze/runtime/cognitive/ReferenceCognitiveGame.tsx')],
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
  ...Object.entries(expFactoryGameFiles).map(([id, file]) => ({
    status: 'native-timeline',
    ids: [id],
    files: [`${file.slice(0, file.indexOf('/'))}/public/legacy/rehab-bridge.js`],
    tokens: [
      'window.jsPsych.init({',
      'timeline: timeline',
      'window.jsPsych.data.dataAsJSON()',
    ],
  })),
  ...Object.entries({
    'motor:drawing-defense': 'drawing-defense/DrawingTowerDefenseGame.tsx',
    'motor:asteroid-shield': 'asteroid-shield/AsteroidShieldGame.tsx',
    'motor:gesture-battler': 'gesture-battler/GestureBattlerGame.tsx',
    'motor:motor-cortex-rehab': 'motor-cortex-rehab/MotorCortexRehabGame.tsx',
    'brain:minesweeper': 'minesweeper/MinesweeperGame.tsx',
    'mouth:tongue-catch': 'tongue-catch/TongueCatchGame.tsx',
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
  resolve(moduleRoot, 'maze/runtime/jsPsychLifecycle.ts'),
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
  'motor:asteroid-shield': 'asteroid-shield/AsteroidShieldGame.tsx',
  'motor:gesture-battler': 'gesture-battler/GestureBattlerGame.tsx',
  'motor:motor-cortex-rehab': 'motor-cortex-rehab/MotorCortexRehabGame.tsx',
  'vision:oculomotor-training': 'oculomotor-training/OculomotorTrainingGame.tsx',
  'brain:every-ball-response': 'every-ball-response/EveryBallResponsePage.tsx',
  'mouth:tongue-catch': 'tongue-catch/TongueCatchGame.tsx',
};
const nativeTimelinePermissionImplementations = {
  'vision:oculomotor-training': resolve(
    repoRoot,
    'apps/rehabtrainerhub/games/oculomotor-training/webgazer/webgazerCalibration.ts',
  ),
};
const mediaPermissionPreflightSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/hooks/useMediaPermissionPreflight.ts'),
  'utf8',
);
assert.ok(
  mediaPermissionPreflightSource.includes('RequestHubTrainingConfiguration()'),
  'Media preflight failures must request the Hub-owned form even when a phase change cancels the consuming effect.',
);
const directMediaAccessFiles = [
  ...ListTypeScriptFiles(moduleRoot),
].filter((file) => {
  const source = readFileSync(file, 'utf8');
  return /mediaDevices\??\.getUserMedia|WebGazerInitCameraPlugin/.test(source);
}).map((file) => relative(repoRoot, file).replaceAll('\\', '/')).sort();
const expectedDirectMediaAccessFiles = [
  ...Object.values(configPermissionImplementations)
    .filter((file) => file !== 'oculomotor-training/OculomotorTrainingGame.tsx')
    .map((file) => `apps/rehabtrainerhub/games/${file}`),
  ...Object.values(nativeTimelinePermissionImplementations)
    .map((file) => relative(repoRoot, file).replaceAll('\\', '/')),
].sort();
assert.deepEqual(
  directMediaAccessFiles,
  expectedDirectMediaAccessFiles,
  'Every direct camera or microphone caller must belong to a declared media-permission module.',
);
const permissionModuleIds = catalogIds.filter((catalogId) => (
  trainingModuleFlowManifest[catalogId].mediaPermission !== 'none'
));
assert.deepEqual(
  permissionModuleIds.sort(),
  Object.keys(configPermissionImplementations).sort(),
  'The media-permission manifest must match the modules that request camera or microphone access.',
);
for (const [catalogId, file] of Object.entries(configPermissionImplementations)) {
  const source = readFileSync(resolve(moduleRoot, file), 'utf8');
  assert.ok(
    source.includes('useMediaPermissionPreflight'),
    `${catalogId} must preflight its camera or microphone permission before training.`,
  );
  assert.ok(
    source.includes('RequestHubTrainingConfiguration'),
    `${catalogId} must return denied media access to the Hub-owned settings form.`,
  );
}
for (const [catalogId, file] of Object.entries(configPermissionImplementations)) {
  if (catalogId === 'vision:oculomotor-training') continue;
  const source = readFileSync(resolve(moduleRoot, file), 'utf8');
  assert.ok(
    !source.includes('<TrainingConfigPanel'),
    `${catalogId} must use the shared settings.json form.`,
  );
  assert.equal(
    (source.match(/setPhase\('menu'\)/g) ?? []).length,
    0,
    `${catalogId} must return configuration ownership to the shell.`,
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
  turboConfig.globalDependencies?.includes('apps/rehabtrainerhub/games/**'),
  'Turbo must invalidate Trainer builds when canonical Hub module sources change.',
);

console.log(
  `Training flow contract passed for ${catalogIds.length} Hub-owned games and ${implementationGroups.length} game flows.`,
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

function ListTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return ListTypeScriptFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
