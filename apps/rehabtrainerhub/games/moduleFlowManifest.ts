export type TrainingFlowStep =
  | 'card'
  | 'config'
  | 'rules'
  | 'tour'
  | 'training'
  | 'results';

export const standardTrainingFlow: readonly TrainingFlowStep[] = [
  'card',
  'config',
  'rules',
  'tour',
  'training',
  'results',
] as const;

export const tourTrainingFlow: readonly TrainingFlowStep[] = [
  'card',
  'config',
  'tour',
  'training',
  'results',
] as const;
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

const manifestEntries: ReadonlyArray<readonly [
  catalogId: string,
  sourcePath: string,
  mediaPermission?: TrainingMediaPermission,
  jsPsychLifecycle?: TrainingJsPsychLifecycle,
  flow?: readonly TrainingFlowStep[],
]> = [
  ['motor:drawing-defense', 'drawing-defense/DrawingTowerDefenseGame.tsx', 'none', 'external-runtime-adapter'],
  ['motor:asteroid-shield', 'asteroid-shield/AsteroidShieldGame.tsx', 'camera-optional', 'external-runtime-adapter'],
  ['motor:gesture-battler', 'gesture-battler/GestureBattlerGame.tsx', 'camera', 'external-runtime-adapter'],
  ['motor:motor-cortex-rehab', 'motor-cortex-rehab/MotorCortexRehabGame.tsx', 'camera', 'external-runtime-adapter'],
  ['vision:moving-card', 'moving-card/pixi-moving-card.ts', 'none', 'native-timeline'],
  ['vision:oculomotor-training', 'oculomotor-training/pixi-oculomotor-training.ts', 'camera-optional', 'native-timeline'],
  ['vision:gabor-patching', 'gabor-patching/pixi-gabor-patching.ts', 'none', 'native-timeline'],
  ['vision:reading-training', 'reading-training/pixi-reading-training.ts', 'none', 'native-timeline'],
  ['vision:driving-rehab', 'driving-rehab/three-driving-rehab.ts', 'none', 'native-timeline'],
  ['vision:hart-chart', 'hart-chart/HartChartPage.tsx', 'none', 'external-runtime-adapter'],
  ['brain:ufov', 'ufov/PeripheralAttentionPage.tsx', 'none', 'native-timeline'],
  ['brain:every-ball-response', 'every-ball-response/EveryBallResponsePage.tsx', 'camera-or-microphone', 'native-timeline'],
  ['brain:minesweeper', 'minesweeper/MinesweeperGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:stroop', 'stroop/StroopGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:flanker', 'flanker/FlankerGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:go-nogo', 'go-nogo/GoNoGoGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:n-back', 'n-back/NBackGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:digit-span', 'digit-span/DigitSpanGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:spatial-span', 'spatial-span/SpatialSpanGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:stop-signal', 'stop-signal/StopSignalGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:tower-of-london', 'tower-of-london/TowerOfLondonGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:attention-network-task', 'attention-network-task/AttentionNetworkTaskGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:letter-memory', 'letter-memory/LetterMemoryGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:number-letter', 'number-letter/NumberLetterGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:antisaccade', 'antisaccade/AntisaccadeGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:keep-track', 'keep-track/KeepTrackGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:plus-minus', 'plus-minus/PlusMinusGame.tsx', 'none', 'native-timeline', tourTrainingFlow],
  ['brain:reaction-time', 'reaction-time/ReactionTimeGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:whack-a-mole', 'whack-a-mole/TargetClickGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:memory-match', 'memory-match/MemoryMatchGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:simon-says', 'simon-says/SimonSaysGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:lights-out', 'lights-out/LightsOutGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:sliding-puzzle', 'sliding-puzzle/SlidingPuzzleGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:sudoku', 'sudoku/SudokuGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:tic-tac-toe', 'tic-tac-toe/TicTacToeGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:connect4', 'connect4/Connect4Game.ts', 'none', 'external-runtime-adapter'],
  ['brain:dots-and-boxes', 'dots-and-boxes/DotsAndBoxesGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:hex', 'hex/HexGame.ts', 'none', 'external-runtime-adapter'],
  ['brain:maze', 'maze/MazeGame.ts', 'none', 'external-runtime-adapter'],
  ['mouth:tongue-catch', 'tongue-catch/TongueCatchGame.tsx', 'camera', 'external-runtime-adapter'],
];

export const trainingModuleFlowManifest: Readonly<Record<
  string,
  TrainingModuleFlowManifestEntry
>> = Object.fromEntries(manifestEntries.map(([
  catalogId,
  sourcePath,
  mediaPermission = 'none',
  jsPsychLifecycle = 'external-runtime-adapter',
  flow = standardTrainingFlow,
]) => [
  catalogId,
  {
    flow,
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
