#!/usr/bin/env node
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(repoRoot, 'apps/rehabtrainerhub/training-modules');
const catalogSource = readFileSync(resolve(moduleRoot, 'catalog.ts'), 'utf8');
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
  /\{\s*id:\s*'([^']+)',\s*trainer:\s*'([^']+)'/g,
)].map((match) => `${match[2]}:${match[1]}`);
const manifestIds = Object.keys(trainingModuleFlowManifest);

assert.equal(catalogIds.length, 29, 'The Hub catalog must expose all 29 playable training modules.');
assert.deepEqual(
  [...manifestIds].sort(),
  [...catalogIds].sort(),
  'Every catalog module must have exactly one Hub-owned flow manifest.',
);

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
      'brain/pages/UFOVPage.tsx',
      'brain/pages/ufov/UfovPage.tsx',
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
    ids: ['brain:main-concept'],
    files: ['brain/pages/MainConceptTraining.tsx'],
    tokens: [
      "useTrainingConfigReady(phase === 'menu')",
      "setPhase('instructions')",
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
    files: ['brain/pages/ufov/UfovPage.tsx'],
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
    ids: ['brain:main-concept'],
    files: ['brain/pages/MainConceptTraining.tsx'],
    tokens: [
      'initJsPsych(',
      'new JsPsychExternalLifecycle(',
      'jsPsychLifecycleRef.current?.start({',
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
    'motor:drawing-defense': 'motor/pages/training/DrawingTowerDefenseGame.tsx',
    'motor:asteroid-shield': 'motor/pages/training/AsteroidShieldGame.tsx',
    'motor:gesture-battler': 'motor/pages/training/GestureBattlerGame.tsx',
    'motor:motor-cortex-rehab': 'motor/pages/training/MotorCortexRehabGame.tsx',
    'brain:minesweeper': 'brain/pages/thinking/MinesweeperGame.tsx',
    'mouth:tongue-catch': 'mouth/pages/training/TongueCatchGame.tsx',
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

const permissionImplementations = {
  'motor:asteroid-shield': 'motor/pages/training/AsteroidShieldGame.tsx',
  'motor:gesture-battler': 'motor/pages/training/GestureBattlerGame.tsx',
  'motor:motor-cortex-rehab': 'motor/pages/training/MotorCortexRehabGame.tsx',
  'vision:oculomotor-training': 'vision/pages/HomePage.tsx',
  'brain:every-ball-response': 'brain/pages/EveryBallResponsePage.tsx',
  'mouth:tongue-catch': 'mouth/pages/training/TongueCatchGame.tsx',
};
const permissionModuleIds = catalogIds.filter((catalogId) => (
  trainingModuleFlowManifest[catalogId].mediaPermission !== 'none'
));
assert.deepEqual(
  permissionModuleIds.sort(),
  Object.keys(permissionImplementations).sort(),
  'The media-permission manifest must match the modules that request camera or microphone access.',
);
for (const [catalogId, file] of Object.entries(permissionImplementations)) {
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
    'brain:set-game',
    'brain:sokoban',
    'brain:maze',
  ];
}
