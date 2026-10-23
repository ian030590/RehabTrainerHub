export type TrainingFlowStep =
  | 'card'
  | 'config'
  | 'rules'
  | 'training'
  | 'results';

export const standardTrainingFlow: readonly TrainingFlowStep[] = [
  'card',
  'config',
  'rules',
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
  ['motor:asteroid-shield', 'asteroid-shield/AsteroidShieldGame.tsx', 'none', 'external-runtime-adapter'],
  ['motor:gesture-battler', 'gesture-battler/GestureBattlerGame.tsx', 'camera', 'external-runtime-adapter'],
  ['motor:motor-cortex-rehab', 'motor-cortex-rehab/MotorCortexRehabGame.tsx', 'camera', 'external-runtime-adapter'],
  ['vision:moving-card', 'moving-card/pixi-moving-card.ts', 'none', 'native-timeline'],
  ['vision:oculomotor-training', 'oculomotor-training/public/reference/experiment.js', 'camera-optional', 'native-timeline'],
  ['vision:gabor-patching', 'gabor-patching/pixi-gabor-patching.ts', 'none', 'native-timeline'],
  ['vision:reading-training', 'reading-training/pixi-reading-training.ts', 'none', 'native-timeline'],
  ['vision:driving-rehab', 'driving-rehab/three-driving-rehab.ts', 'none', 'native-timeline'],
  ['vision:hart-chart', 'hart-chart/HartChartPage.tsx', 'none', 'external-runtime-adapter'],
  ['brain:ufov', 'ufov/UfovGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:every-ball-response', 'every-ball-response/EveryBallResponsePage.tsx', 'camera-or-microphone', 'native-timeline'],
  ['brain:sart', 'sart/SartGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:schulte-grid', 'schulte-grid/SchulteGridGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:hex-schulte', 'hex-schulte/HexSchulteGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:continuous-performance', 'continuous-performance/ContinuousPerformanceGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:simon-task', 'simon-task/SimonTaskGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:card-sorting', 'card-sorting/CardSortingGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:attentional-blink', 'attentional-blink/AttentionalBlinkGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:time-perception', 'time-perception/TimePerceptionGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:divided-attention', 'divided-attention/DividedAttentionGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:pattern-memory', 'pattern-memory/PatternMemoryGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:minesweeper', 'minesweeper/MinesweeperGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:stroop', 'stroop/StroopGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:flanker', 'flanker/FlankerGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:go-nogo', 'go-nogo/GoNoGoGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:n-back', 'n-back/NBackLetters.tsx', 'none', 'external-runtime-adapter'],
  ['brain:digit-span', 'digit-span/DigitSpanRecall.tsx', 'none', 'external-runtime-adapter'],
  ['brain:spatial-span', 'spatial-span/SpatialSpanRecall.tsx', 'none', 'external-runtime-adapter'],
  ['brain:stop-signal', 'stop-signal/StopSignalGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:tower-of-london', 'tower-of-london/TowerPlanning.tsx', 'none', 'external-runtime-adapter'],
  ['brain:attention-network-task', 'attention-network-task/AttentionNetworkGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:letter-memory', 'letter-memory/LetterMemoryRecall.tsx', 'none', 'external-runtime-adapter'],
  ['brain:number-letter', 'number-letter/NumberLetterSwitch.tsx', 'none', 'external-runtime-adapter'],
  ['brain:antisaccade', 'antisaccade/AntisaccadeGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:keep-track', 'keep-track/KeepTrackRecall.tsx', 'none', 'external-runtime-adapter'],
  ['brain:plus-minus', 'plus-minus/PlusMinusSwitch.tsx', 'none', 'external-runtime-adapter'],
  ['brain:reaction-time', 'reaction-time/ReactionSignal.tsx', 'none', 'external-runtime-adapter'],
  ['brain:whack-a-mole', 'whack-a-mole/WhackAMoleGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:memory-match', 'memory-match/MemoryMatchGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:simon-says', 'simon-says/SimonSaysGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:lights-out', 'lights-out/LightsOutGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:sliding-puzzle', 'sliding-puzzle/SlidingPuzzleGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:sudoku', 'sudoku/SudokuGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:tic-tac-toe', 'tic-tac-toe/TicTacToeGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:connect4', 'connect4/Connect4Game.tsx', 'none', 'external-runtime-adapter'],
  ['brain:dots-and-boxes', 'dots-and-boxes/DotsAndBoxesGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:hex', 'hex/HexGame.tsx', 'none', 'external-runtime-adapter'],
  ['brain:maze', 'maze/MazeGame.tsx', 'none', 'external-runtime-adapter'],
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
