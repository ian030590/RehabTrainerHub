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

export interface TrainingModuleFlowManifestEntry {
  flow: readonly TrainingFlowStep[];
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
]> = [
  ['motor:drawing-defense', 'motor/pages/training/DrawingTowerDefenseGame.tsx'],
  ['motor:asteroid-shield', 'motor/pages/training/AsteroidShieldGame.tsx', 'camera-optional'],
  ['motor:gesture-battler', 'motor/pages/training/GestureBattlerGame.tsx', 'camera'],
  ['motor:motor-cortex-rehab', 'motor/pages/training/MotorCortexRehabGame.tsx', 'camera'],
  ['vision:moving-card', 'vision/experiment/plugins/pixi-moving-card.ts'],
  ['vision:oculomotor-training', 'vision/experiment/plugins/pixi-oculomotor-training.ts', 'camera-optional'],
  ['vision:gabor-patching', 'vision/experiment/plugins/pixi-gabor-patching.ts'],
  ['vision:reading-training', 'vision/experiment/plugins/pixi-reading-training.ts'],
  ['vision:driving-rehab', 'vision/experiment/plugins/three-driving-rehab.ts'],
  ['vision:hart-chart', 'vision/pages/training/HartChartPage.tsx'],
  ['brain:ufov', 'brain/pages/UFOVPage.tsx'],
  ['brain:every-ball-response', 'brain/pages/EveryBallResponsePage.tsx', 'camera-or-microphone'],
  ['brain:main-concept', 'brain/pages/MainConceptTraining.tsx'],
  ['brain:minesweeper', 'brain/pages/thinking/MinesweeperGame.tsx'],
  ...referenceCognitiveIds.map((catalogId) => (
    [catalogId, 'brain/pages/thinking/ReferenceCognitiveGame.tsx'] as const
  )),
  ['mouth:tongue-catch', 'mouth/pages/training/TongueCatchGame.tsx', 'camera'],
];

export const trainingModuleFlowManifest: Readonly<Record<
  string,
  TrainingModuleFlowManifestEntry
>> = Object.fromEntries(manifestEntries.map(([
  catalogId,
  sourcePath,
  mediaPermission = 'none',
]) => [
  catalogId,
  {
    flow: standardTrainingFlow,
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
