import type { TranslationKey } from '../../../i18n';

export type ReferenceGameId =
  | 'memory-match'
  | 'lights-out'
  | 'reaction-time'
  | 'whack-a-mole'
  | 'sliding-puzzle'
  | 'sudoku'
  | 'bulls-and-cows'
  | 'simon-says'
  | 'tic-tac-toe'
  | 'connect4'
  | 'dots-and-boxes'
  | 'hex'
  | 'set-game'
  | 'sokoban'
  | 'maze';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GamePhase = 'menu' | 'rules' | 'playing' | 'results';
export type GameResult = 'Victory' | 'Defeat';
export type SessionLimitSeconds = number | null;

export interface ReferenceModuleMeta {
  id: ReferenceGameId;
  titleKey: TranslationKey;
  referenceTitleKey: TranslationKey;
  descriptionKey: TranslationKey;
  focusKey: TranslationKey;
}

export interface SessionRecord {
  Test_Date: string;
  Participant_ID: string;
  Game_ID: ReferenceGameId;
  Game_Title: string;
  Difficulty: Difficulty;
  Session_Limit_Seconds: string;
  Target_Trials: number;
  Total_Duration_Seconds: number;
  Score: number;
  Accuracy_Percent: number;
  Moves: number;
  Attempts: number;
  Success_Count: number;
  Error_Count: number;
  Game_Result: GameResult;
  Details_JSON: string;
}

export interface RuntimeMetrics {
  elapsed: number;
}

export interface ResultStats {
  score: number;
  accuracy: number;
  moves: number;
  attempts: number;
  success: number;
  errors: number;
  details: Record<string, unknown>;
}

export interface MemoryCard {
  value: string;
  revealed: boolean;
  matched: boolean;
}

export interface MemoryState {
  kind: 'memory-match';
  rows: number;
  cols: number;
  pairs: number;
  cards: MemoryCard[];
  flipped: number[];
  matchedPairs: number;
  moves: number;
  errors: number;
  mismatchClearAt: number | null;
}

export interface LightsOutState {
  kind: 'lights-out';
  size: number;
  lights: boolean[][];
  moves: number;
}

export interface ReactionState {
  kind: 'reaction-time';
  status: 'waiting' | 'ready' | 'go' | 'result' | 'too-early';
  attempts: number[];
  falseStarts: number;
  targetTrials: number;
  goAt: number | null;
  goStartedAt: number | null;
  lastReactionMs: number | null;
}

export interface WhackState {
  kind: 'whack-a-mole';
  gridSize: number;
  activeIndex: number | null;
  nextTargetAt: number;
  targetExpiresAt: number | null;
  targetMs: number;
  minDelay: number;
  maxDelay: number;
  hits: number;
  misses: number;
  taps: number;
}

export interface SlidingState {
  kind: 'sliding-puzzle';
  size: number;
  tiles: number[];
  blankIndex: number;
  moves: number;
  errors: number;
}

export interface NumberGridState {
  kind: 'sudoku' | 'latin-square' | 'magic-square';
  size: number;
  boxSize?: number;
  solution: number[];
  values: number[];
  givens: boolean[];
  moves: number;
  errors: number;
}

export interface BullsAttempt {
  guess: number[];
  bulls: number;
  cows: number;
}

export interface BullsAndCowsState {
  kind: 'bulls-and-cows';
  secret: number[];
  guess: number[];
  selectedSlot: number;
  attempts: BullsAttempt[];
  maxAttempts: number;
  moves: number;
  errors: number;
}

export interface SimonState {
  kind: 'simon-says';
  sequence: number[];
  inputIndex: number;
  litIndex: number | null;
  showIndex: number;
  nextStepAt: number;
  targetRounds: number;
  status: 'showing' | 'input';
  moves: number;
  errors: number;
}

export interface TicTacToeState {
  kind: 'tic-tac-toe';
  size: number;
  winLength: number;
  board: Array<'X' | 'O' | null>;
  moves: number;
  aiMoves: number;
  errors: number;
}

export interface Connect4State {
  kind: 'connect4';
  rows: number;
  cols: number;
  board: Array<'P' | 'A' | null>;
  moves: number;
  aiMoves: number;
  errors: number;
}

export interface DotsAndBoxesState {
  kind: 'dots-and-boxes';
  size: number;
  hLines: boolean[];
  vLines: boolean[];
  boxes: Array<'P' | 'A' | null>;
  moves: number;
  aiMoves: number;
  errors: number;
  playerScore: number;
  aiScore: number;
}

export interface HexState {
  kind: 'hex';
  size: number;
  board: number[];
  moves: number;
  aiMoves: number;
  errors: number;
}

export interface SetCard {
  id: string;
  color: number;
  shape: number;
  fill: number;
  count: number;
}

export interface SetGameState {
  kind: 'set-game';
  deck: SetCard[];
  board: SetCard[];
  selected: number[];
  found: number;
  targetSets: number;
  moves: number;
  errors: number;
}

export interface SokobanState {
  kind: 'sokoban';
  rows: number;
  cols: number;
  walls: number[];
  boxes: number[];
  targets: number[];
  player: number;
  moves: number;
  pushes: number;
  errors: number;
}

export interface MazeCell {
  top: boolean;
  right: boolean;
  bottom: boolean;
  left: boolean;
}

export interface MazeState {
  kind: 'maze';
  size: number;
  cells: MazeCell[];
  current: number;
  end: number;
  moves: number;
  errors: number;
}

export type CognitiveGameState =
  | MemoryState
  | LightsOutState
  | ReactionState
  | WhackState
  | SlidingState
  | NumberGridState
  | BullsAndCowsState
  | SimonState
  | TicTacToeState
  | Connect4State
  | DotsAndBoxesState
  | HexState
  | SetGameState
  | SokobanState
  | MazeState;
