export const standardTrainingFlow = [
  'card',
  'config',
  'rules',
  'training',
  'results',
] as const;

export type TrainingFlowStep = (typeof standardTrainingFlow)[number];
export type TrainingMediaPermission =
  | 'none'
  | 'camera'
  | 'camera-optional'
  | 'camera-or-microphone';

export type TrainingJsPsychLifecycle =
  | 'native-timeline'
  | 'external-runtime-adapter';

export interface TrainingModuleFlowManifestEntry {
  flow: readonly TrainingFlowStep[];
  jsPsychLifecycle: TrainingJsPsychLifecycle;
  mediaPermission: TrainingMediaPermission;
  sourcePath: string;
}

const referenceCognitiveIds = [
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
] as const;

const manifestEntries: ReadonlyArray<readonly [
  catalogId: string,
  sourcePath: string,
  mediaPermission?: TrainingMediaPermission,
  jsPsychLifecycle?: TrainingJsPsychLifecycle,
]> = [
  ['motor:drawing-defense', 'motor/pages/training/DrawingTowerDefenseGame.tsx', 'none', 'external-runtime-adapter'],
  ['motor:asteroid-shield', 'motor/pages/training/AsteroidShieldGame.tsx', 'camera-optional', 'external-runtime-adapter'],
  ['motor:gesture-battler', 'motor/pages/training/GestureBattlerGame.tsx', 'camera', 'external-runtime-adapter'],
  ['motor:motor-cortex-rehab', 'motor/pages/training/MotorCortexRehabGame.tsx', 'camera', 'external-runtime-adapter'],
  ['vision:moving-card', 'vision/experiment/plugins/pixi-moving-card.ts', 'none', 'native-timeline'],
  ['vision:oculomotor-training', 'vision/experiment/plugins/pixi-oculomotor-training.ts', 'camera-optional', 'native-timeline'],
  ['vision:gabor-patching', 'vision/experiment/plugins/pixi-gabor-patching.ts', 'none', 'native-timeline'],
  ['vision:reading-training', 'vision/experiment/plugins/pixi-reading-training.ts', 'none', 'native-timeline'],
  ['vision:driving-rehab', 'vision/experiment/plugins/three-driving-rehab.ts', 'none', 'native-timeline'],
  ['vision:hart-chart', 'vision/pages/training/HartChartPage.tsx', 'none', 'external-runtime-adapter'],
  ['brain:ufov', 'brain/pages/PeripheralAttentionPage.tsx', 'none', 'native-timeline'],
  ['brain:every-ball-response', 'brain/pages/EveryBallResponsePage.tsx', 'camera-or-microphone', 'native-timeline'],
  ['brain:main-concept', 'brain/pages/MainConceptTraining.tsx', 'none', 'external-runtime-adapter'],
  ['brain:minesweeper', 'brain/pages/thinking/MinesweeperGame.tsx', 'none', 'external-runtime-adapter'],
  ...referenceCognitiveIds.map((catalogId) => (
    [catalogId, 'brain/pages/thinking/ReferenceCognitiveGame.tsx', 'none', 'external-runtime-adapter'] as const
  )),
  ['mouth:tongue-catch', 'mouth/pages/training/TongueCatchGame.tsx', 'camera', 'external-runtime-adapter'],
];

export const trainingModuleFlowManifest: Readonly<Record<
  string,
  TrainingModuleFlowManifestEntry
>> = Object.fromEntries(manifestEntries.map(([
  catalogId,
  sourcePath,
  mediaPermission = 'none',
  jsPsychLifecycle = 'external-runtime-adapter',
]) => [
  catalogId,
  {
    flow: standardTrainingFlow,
    jsPsychLifecycle,
    mediaPermission,
    sourcePath,
  },
]));

export function GetTrainingModuleFlowManifest(
  catalogId: string,
): TrainingModuleFlowManifestEntry {
  const manifest = trainingModuleFlowManifest[catalogId];
  if (!manifest) {
    throw new Error(`Missing Hub training-module flow manifest for ${catalogId}.`);
  }
  return manifest;
}
