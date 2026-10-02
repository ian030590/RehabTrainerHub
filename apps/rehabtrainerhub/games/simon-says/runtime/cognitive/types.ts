export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface SimonTrialRecord {
  trialNumber: number;
  memoryLength: number;
  correct: boolean;
  durationMs: number;
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

export interface SimonTapResult {
  accepted: boolean;
  trial: SimonTrialRecord | null;
  gameResult: 'Victory' | 'Defeat' | null;
  replaySequence: boolean;
}
