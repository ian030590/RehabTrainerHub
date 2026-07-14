import type { TranslationKey } from '../../../i18n';

export type ReferenceGameId = 'memory-match' | 'lights-out' | 'reaction-time' | 'whack-a-mole' | 'sliding-puzzle';

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

export type CognitiveGameState =
  | MemoryState
  | LightsOutState
  | ReactionState
  | WhackState
  | SlidingState;
