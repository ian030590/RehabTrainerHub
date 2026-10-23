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
  trainingModuleFlowManifest,
} = await import(manifestUrl);

const catalogIds = [...catalogSource.matchAll(
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*(?:'([^']+)'|[A-Za-z][A-Za-z0-9]*Catalog\.trainer)/g,
)].map((match) => `${match[2] ?? JSON.parse(readFileSync(resolve(moduleRoot, match[1], 'public/game.json'), 'utf8')).trainer}:${match[1]}`);
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
const hubGameCatalogSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/gameCatalog.ts'), 'utf8');
const progressSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/progress/ProgressDashboard.tsx'), 'utf8');
const themeStyleSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/trainingThemeStyle.ts'), 'utf8');
const lobbyCssSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/globals.css'), 'utf8');
const developerPortalSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/app/developer/DeveloperPortal.tsx'), 'utf8');
const developerGamesApiSource = readFileSync(resolve(repoRoot, 'apps/rehabtrainerhub/functions/api/developer/games.js'), 'utf8');
for (const [label, source] of [['lobby', lobbySource], ['progress', progressSource]]) {
  const themeSource = label === 'lobby' ? hubGameCatalogSource : source;
  assert.ok(themeSource.includes('GetTrainingModuleTheme'), `${label} cards must resolve their appearance from the theme registry.`);
  assert.ok(source.includes('BuildTrainingThemeStyle'), `${label} cards must inject the resolved theme as CSS variables.`);
  assert.ok(!source.includes('trainerVisuals'), `${label} must not keep a parallel trainer-specific visual registry.`);
}
assert.ok(themeStyleSource.includes("'--trainer-color'"), 'The shared theme style builder must inject theme CSS variables.');
assert.ok(!lobbySource.includes('publishedCategoryPurposes'), 'Published-game aliases must resolve from the single theme registry.');
assert.ok(lobbySource.includes('BuildHubGameCatalog'), 'Lobby cards must consume the unified theme-resolved game catalog.');
assert.ok(hubGameCatalogSource.includes('GetTrainingThemeId(game.category)'), 'Published-game filters and counts must resolve registry aliases.');
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

// Board-game opponents wait one second; each R2 board game owns that delay in its own package.
for (const [id, component] of [['tic-tac-toe', 'TicTacToeGame'], ['connect4', 'Connect4Game'], ['hex', 'HexGame'], ['dots-and-boxes', 'DotsAndBoxesGame']]) {
  const source = readFileSync(resolve(moduleRoot, `${id}/${component}.tsx`), 'utf8');
  assert.ok(source.includes('const computerDelayMs = 1000;'), `${id}: the computer must wait one second before moving.`);
  assert.ok(source.includes('computerTurn('), `${id}: the computer move must run after the delay.`);
}

// The R2 maze owns its on-screen direction pad; arrows are drawn as SVG, never as glyphs or emoji.
const mazeSource = readFileSync(resolve(moduleRoot, 'maze/MazeGame.tsx'), 'utf8');
const mazePadSource = readFileSync(resolve(moduleRoot, 'maze/DirectionPad.tsx'), 'utf8');
assert.ok(mazeSource.includes('<DirectionPad'), 'Maze must expose touch direction controls while playing.');
assert.ok(mazePadSource.includes('<svg'), 'Maze direction controls must use SVG icons.');
assert.ok(!/[↑↓←→⬆⬇⬅➡]/u.test(mazePadSource), 'Maze direction controls must not use arrow glyphs or emoji.');
// Every Ball Response still uses the shared touch controls, so their arrows stay SVG as well.
const mobileControlsSource = readFileSync(resolve(repoRoot, 'packages/ui/src/components/MobileTouchControls.tsx'), 'utf8');
assert.ok(mobileControlsSource.includes('<svg'), 'Mobile direction controls must use SVG icons.');
assert.ok(!mobileControlsSource.includes("up: '↑'"), 'Mobile direction controls must not use arrow glyphs or emoji.');

for (const catalogId of catalogIds) {
  const manifest = trainingModuleFlowManifest[catalogId];
  assert.deepEqual(
    manifest.flow,
    standardTrainingFlow,
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

// Brain activities written directly as R2 packages: [gameId, component, tutorial].
const nativeBrainGames = [
  ['sart', 'SartGame', 'SartTutorial'],
  ['schulte-grid', 'SchulteGridGame', 'SchulteTutorial'],
  ['hex-schulte', 'HexSchulteGame', 'HexTutorial'],
  ['continuous-performance', 'ContinuousPerformanceGame', 'CptTutorial'],
  ['simon-task', 'SimonTaskGame', 'SimonTutorial'],
  ['card-sorting', 'CardSortingGame', 'SortingTutorial'],
  ['attentional-blink', 'AttentionalBlinkGame', 'BlinkTutorial'],
  ['time-perception', 'TimePerceptionGame', 'TimingTutorial'],
  ['divided-attention', 'DividedAttentionGame', 'DividedTutorial'],
  ['pattern-memory', 'PatternMemoryGame', 'PatternTutorial'],
  ['stroop', 'StroopGame', 'StroopTutorial'],
  ['flanker', 'FlankerGame', 'FlankerTutorial'],
  ['go-nogo', 'GoNoGoGame', 'GoNoGoTutorial'],
  ['stop-signal', 'StopSignalGame', 'StopSignalTutorial'],
  ['attention-network-task', 'AttentionNetworkGame', 'AntTutorial'],
  ['n-back', 'NBackLetters', 'NBackTutorial'],
  ['number-letter', 'NumberLetterSwitch', 'NumberLetterTutorial'],
  ['digit-span', 'DigitSpanRecall', 'DigitSpanTutorial'],
  ['spatial-span', 'SpatialSpanRecall', 'SpatialSpanTutorial'],
  ['tower-of-london', 'TowerPlanning', 'TowerTutorial'],
  ['reaction-time', 'ReactionSignal', 'ReactionTutorial'],
  ['tic-tac-toe', 'TicTacToeGame', 'TicTacToeTutorial'],
  ['connect4', 'Connect4Game', 'Connect4Tutorial'],
  ['hex', 'HexGame', 'HexTutorial'],
  ['dots-and-boxes', 'DotsAndBoxesGame', 'DotsTutorial'],
  ['lights-out', 'LightsOutGame', 'LightsOutTutorial'],
  ['sliding-puzzle', 'SlidingPuzzleGame', 'SlidingTutorial'],
  ['maze', 'MazeGame', 'MazeTutorial'],
  ['sudoku', 'SudokuGame', 'SudokuTutorial'],
  ['memory-match', 'MemoryMatchGame', 'MemoryTutorial'],
  ['simon-says', 'SimonSaysGame', 'SimonTutorial'],
  ['whack-a-mole', 'WhackAMoleGame', 'WhackTutorial'],
  ['minesweeper', 'MinesweeperGame', 'MinesweeperTutorial'],
  ['antisaccade', 'AntisaccadeGame', 'AntisaccadeTutorial'],
  ['keep-track', 'KeepTrackRecall', 'KeepTrackTutorial'],
  ['letter-memory', 'LetterMemoryRecall', 'LetterMemoryTutorial'],
  ['plus-minus', 'PlusMinusSwitch', 'PlusMinusTutorial'],
  ['ufov', 'UfovGame', 'UfovTutorial'],
];

const implementationGroups = [
  {
    ids: ['motor:drawing-defense'],
    files: ['drawing-defense/DrawingTowerDefenseGame.tsx'],
    tokens: [
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'SendGameResult',
    ],
  },
  {
    ids: ['motor:asteroid-shield'],
    files: ['asteroid-shield/AsteroidShieldGame.tsx'],
    tokens: [
      "setPhase('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'SendGameResult',
    ],
  },
  {
    ids: ['motor:gesture-battler'],
    files: ['gesture-battler/GestureBattlerGame.tsx'],
    tokens: [
      "setPhase('rules')",
      "setPhase('combat')",
      "phase === 'results'",
      'SendGameResult',
    ],
  },
  {
    ids: ['motor:motor-cortex-rehab'],
    files: ['motor-cortex-rehab/MotorCortexRehabGame.tsx'],
    tokens: [
      "('rules')",
      "setPhase('playing')",
      "phase === 'results'",
      'SendGameResult',
      'MotorTutorial',
    ],
  },
  { ids: ['vision:reading-training'], files: ['reading-training/ReadingTrainingGame.tsx'], tokens: ["setPhase('rules')", "setPhase('running')", "setPhase('results')", 'SendGameResult', 'ReadingTutorial'] },
  { ids: ['vision:gabor-patching'], files: ['gabor-patching/GaborPatchingGame.tsx'], tokens: ["setPhase('rules')", "setPhase('running')", "setPhase('results')", 'SendGameResult', 'GaborTutorial'] },
  { ids: ['vision:moving-card'], files: ['moving-card/MovingCardGame.tsx'], tokens: ["setPhase('rules')", "setPhase('running')", "setPhase('results')", 'SendGameResult', 'MovingCardTutorial'] },
  {
    ids: [
      'vision:driving-rehab',
    ],
    files: [
      'driving-rehab/DrivingRehabGame.tsx',
    ],
    tokens: [
      'DrivingTutorial',
      "setPhase('results')",
      'SendGameResult',
    ],
  },
  {
    ids: ['vision:oculomotor-training'],
    files: ['oculomotor-training/OculomotorTrainingGame.tsx'],
    tokens: ["SendGameEvent('input-start')", "window.OculomotorInput.Stop()", "setPhase('running')", "setPhase('results')", "SendGameEvent('result'", 'OculomotorResults'],
  },
  {
    ids: ['vision:hart-chart'],
    files: [
      'hart-chart/HartChartPage.tsx',
    ],
    tokens: [
      'ValidateSettings(settings)',
      "setPhase('results')",
      'SendGameResult',
    ],
  },
  ...nativeBrainGames.map(([id, component, tutorial]) => ({
    ids: [`brain:${id}`],
    files: [`${id}/${component}.tsx`],
    tokens: ["setPhase('rules')", "setPhase('running')", "setPhase('results')", 'SendGameResult', tutorial, 'ValidateSettings(settings)'],
  })),
  {
    ids: ['brain:every-ball-response'],
    files: ['every-ball-response/EveryBallGame.tsx'],
    tokens: ["setPhase('rules')", "setPhase('playing')", "setPhase('results')", 'SendGameResult', 'EveryBallTutorial', 'ValidateSettings(settings)'],
  },
  {
    ids: ['mouth:tongue-catch'],
    files: ['tongue-catch/TongueCatchGame.tsx'],
    tokens: ["setPhase('rules')", "setPhase('calibration')", "setPhase('playing')", "setPhase('results')", 'SendGameResult', 'TongueTutorial', 'ValidateSettings(settings)'],
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
      'vision:gabor-patching',
      'vision:reading-training',
      'vision:driving-rehab',
    ],
    files: [
      'moving-card/MovingCardGame.tsx',
      'gabor-patching/GaborPatchingGame.tsx',
      'reading-training/ReadingTrainingGame.tsx',
      'moving-card/pixi-moving-card.ts',
      'gabor-patching/pixi-gabor-patching.ts',
      'reading-training/pixi-reading-training.ts',
      'driving-rehab/DrivingRehabGame.tsx',
      'driving-rehab/three-driving-rehab.ts',
    ],
    tokens: ['initJsPsych(', 'jsPsych.run(', 'finishTrial('],
  },
  {
    status: 'native-timeline',
    ids: ['vision:oculomotor-training'],
    files: ['oculomotor-training/public/reference/experiment.js'],
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
  ...nativeBrainGames.map(([id, component]) => ({
    status: 'external-runtime-adapter',
    ids: [`brain:${id}`],
    files: [`${id}/${component}.tsx`],
    tokens: externalRuntimeAdapterTokens,
    forbiddenTokens: ['WriteJsPsychData'],
  })),
  ...Object.entries({
    'motor:drawing-defense': 'drawing-defense/DrawingTowerDefenseGame.tsx',
    'motor:asteroid-shield': 'asteroid-shield/AsteroidShieldGame.tsx',
    'motor:gesture-battler': 'gesture-battler/GestureBattlerGame.tsx',
    'motor:motor-cortex-rehab': 'motor-cortex-rehab/MotorCortexRehabGame.tsx',
    'mouth:tongue-catch': 'tongue-catch/TongueCatchGame.tsx',
    'brain:every-ball-response': 'every-ball-response/EveryBallGame.tsx',
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
  resolve(moduleRoot, 'sart/runtime/jsPsychLifecycle.ts'),
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

// Tongue Catch was the last game to open the camera itself; every camera game now uses a reviewed proxy.
const configPermissionImplementations = {};
const proxyPermissionImplementations = {
  'motor:gesture-battler': { file: 'gesture-battler/GestureBattlerGame.tsx', denialToken: 'gesture.error.permission' },
  'motor:motor-cortex-rehab': { file: 'motor-cortex-rehab/MotorCortexRehabGame.tsx', denialToken: 'labels.permission' },
  'brain:every-ball-response': { file: 'every-ball-response/EveryBallGame.tsx', denialToken: 'labels.errors[inputMode]', start: 'StartSensorInput', stop: 'StopSensorInput' },
  'mouth:tongue-catch': { file: 'tongue-catch/TongueCatchGame.tsx', denialToken: 'labels.errors', start: 'StartSensorInput', stop: 'StopSensorInput' },
};
for (const [catalogId, { file, denialToken, start = 'StartHandInput', stop = 'StopHandInput' }] of Object.entries(proxyPermissionImplementations)) {
  const source = readFileSync(resolve(moduleRoot, file), 'utf8');
  assert.ok(source.includes(start), `${catalogId} must request reviewed private input.`);
  assert.ok(source.includes(stop), `${catalogId} must release private input.`);
  assert.ok(source.includes(denialToken), `${catalogId} must report camera denial.`);
  assert.ok(!/mediaDevices|getUserMedia/.test(source), `${catalogId} cannot request a camera inside the opaque package.`);
}
const nativeTimelinePermissionImplementations = {
  'vision:oculomotor-training': resolve(
    repoRoot,
    'apps/rehabtrainerhub/games/oculomotor-training/public/reference/experiment.js',
  ),
};
const mediaPermissionPreflightSource = readFileSync(
  resolve(repoRoot, 'packages/ui/src/hooks/useMediaPermissionPreflight.ts'),
  'utf8',
);
assert.equal(
  (mediaPermissionPreflightSource.match(/RequestHubTrainingConfiguration\(GetConfigureReason\(audio, video, /g) ?? []).length,
  2,
  'Media preflight failures must request the Hub-owned form, with the reason, even when a phase change cancels the consuming effect.',
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
  [...Object.keys(configPermissionImplementations), ...Object.keys(proxyPermissionImplementations), 'vision:oculomotor-training'].sort(),
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
    source.includes('type: OptionalWebGazerCameraPlugin')
      && source.includes('type: window.jsPsychWebgazerCalibrate')
      && source.includes('type: GazeValidationPlugin'),
    `${catalogId} must run the reference camera, calibration, and validation trials.`,
  );
  assert.ok(source.includes('window.OculomotorInput') && !source.includes('navigator.mediaDevices'), 'Eye timelines use only the reviewed numerical proxy');
}

const turboConfig = JSON.parse(readFileSync(resolve(repoRoot, 'turbo.json'), 'utf8'));
console.log(
  `Training flow contract passed for ${catalogIds.length} Hub-owned games and ${implementationGroups.length} game flows.`,
);
console.log(
  pendingJsPsychIds.length > 0
    ? `jsPsych lifecycle: ${catalogIds.length - pendingJsPsychIds.length} managed by native timelines/adapters; ${pendingJsPsychIds.length} still utility-only (${pendingJsPsychIds.join(', ')}).`
    : `jsPsych lifecycle: all ${catalogIds.length} modules are managed by native timelines or external-runtime adapters; none remain utility-only.`,
);

function ListTypeScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return ListTypeScriptFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}
