export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type TargetTrialOutcome = 'hit' | 'expired' | 'wrong-tap';

export interface TargetTrialRecord {
  trialNumber: number;
  outcome: TargetTrialOutcome;
  reactionTimeMs: number;
  targetIndex: number | null;
  tappedIndex: number | null;
}

export interface WhackState {
  kind: 'whack-a-mole';
  gridSize: number;
  activeIndex: number | null;
  previousIndex: number | null;
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

export interface WhackTapResult {
  trial: TargetTrialRecord;
  targetCompleted: boolean;
}
