// Types local to the Hub-owned cognitive modules.
import type { TranslationKey } from '../../../i18n';

export type ReferenceGameId =
  | 'memory-match'
  | 'lights-out'
  | 'reaction-time'
  | 'whack-a-mole'
  | 'sliding-puzzle'
  | 'sudoku'
  | 'simon-says'
  | 'tic-tac-toe'
  | 'connect4'
  | 'dots-and-boxes'
  | 'hex'
  | 'maze';

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type GamePhase = 'menu' | 'rules' | 'playing' | 'results';
export type GameResult = 'Victory' | 'Defeat' | 'Draw';
export type SessionLimitSeconds = number | null;

export interface ReferenceModuleMeta {
  id: ReferenceGameId;
  titleKey: TranslationKey;
  referenceTitleKey: TranslationKey;
  descriptionKey: TranslationKey;
  focusKey: TranslationKey;
}

export interface SessionRecord {
  Game_Result: GameResult;
  Total_Duration_Seconds: number;
  [key: string]: unknown;
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
  trials: ReactionTrialRecord[];
  falseStarts: number;
  targetTrials: number;
  goAt: number | null;
  goStartedAt: number | null;
  waitStartedAt: number | null;
  lastReactionMs: number | null;
}

export type ReactionTrialOutcome = 'success' | 'false-start';

export interface ReactionTrialRecord {
  trialNumber: number;
  outcome: ReactionTrialOutcome;
  reactionTimeMs: number;
}

export interface WhackState {
  kind: 'whack-a-mole';
  gridSize: number;
  activeIndex: number | null;
  nextTargetAt: number;
  targetExpiresAt: number | null;
  targetStartedAt: number | null;
  targetMs: number;
  minDelay: number;
  maxDelay: number;
  hits: number;
  misses: number;
  taps: number;
  hitReactionMs: number[];
  trials: TargetTrialRecord[];
}

export type TargetTrialOutcome = 'hit' | 'expired' | 'wrong-tap';

export interface TargetTrialRecord {
  trialNumber: number;
  outcome: TargetTrialOutcome;
  reactionTimeMs: number;
  targetIndex: number | null;
  tappedIndex: number | null;
}

export interface WhackTapResult {
  trial: TargetTrialRecord;
  targetCompleted: boolean;
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

export interface SimonState {
  kind: 'simon-says';
  sequence: number[];
  inputIndex: number;
  litIndex: number | null;
  litStartedAt: number | null;
  showIndex: number;
  nextStepAt: number;
  targetRounds: number;
  status: 'showing' | 'input' | 'ended';
  lives: number;
  maxLives: number;
  attemptStartedAt: number | null;
  pressedIndex: number | null;
  pressedStartedAt: number | null;
  trials: SimonTrialRecord[];
  moves: number;
  errors: number;
}

export interface SimonTrialRecord {
  trialNumber: number;
  memoryLength: number;
  correct: boolean;
  durationMs: number;
}

export interface SimonTapResult {
  accepted: boolean;
  trial: SimonTrialRecord | null;
  gameResult: GameResult | null;
  replaySequence: boolean;
}

export interface TicTacToeState {
  kind: 'tic-tac-toe';
  size: number;
  winLength: number;
  board: Array<'X' | 'O' | null>;
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
}

export interface Connect4State {
  kind: 'connect4';
  rows: number;
  cols: number;
  board: Array<'P' | 'A' | null>;
  drops: Array<{ index: number; mark: 'P' | 'A'; startedAt: number }>;
  winningLine: number[];
  pendingResult: { result: GameResult; finishAt: number } | null;
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
  errors: number;
}

export interface DotsAndBoxesState {
  kind: 'dots-and-boxes';
  size: number;
  hLines: Array<'P' | 'A' | null>;
  vLines: Array<'P' | 'A' | null>;
  boxes: Array<'P' | 'A' | null>;
  aiMoveAt: number | null;
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
  aiMoveAt: number | null;
  moves: number;
  aiMoves: number;
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
  | SimonState
  | TicTacToeState
  | Connect4State
  | DotsAndBoxesState
  | HexState
  | MazeState;
