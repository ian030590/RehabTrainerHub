import type {
  Difficulty,
  ReactionTrialOutcome,
  ReactionTrialRecord,
  SimonState,
  SimonTapResult,
  SimonTrialRecord,
  TargetTrialOutcome,
  TargetTrialRecord,
} from './types';

export function GetElapsedMilliseconds(startMs: number | null, endMs: number) {
  if (startMs === null || !Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;
  return Math.max(0, Math.round(endMs - startMs));
}

export function CreateReactionTrialRecord(
  trialNumber: number,
  outcome: ReactionTrialOutcome,
  startMs: number | null,
  endMs: number,
): ReactionTrialRecord {
  return {
    trialNumber,
    outcome,
    reactionTimeMs: GetElapsedMilliseconds(startMs, endMs),
  };
}

export function CreateTargetTrialRecord(
  trialNumber: number,
  outcome: TargetTrialOutcome,
  startMs: number | null,
  endMs: number,
  targetIndex: number | null,
  tappedIndex: number | null,
): TargetTrialRecord {
  return {
    trialNumber,
    outcome,
    reactionTimeMs: GetElapsedMilliseconds(startMs, endMs),
    targetIndex,
    tappedIndex,
  };
}

export function CreateSimonTrialRecord(
  trialNumber: number,
  memoryLength: number,
  correct: boolean,
  attemptStartedAtSeconds: number | null,
  endedAtSeconds: number,
): SimonTrialRecord {
  return {
    trialNumber,
    memoryLength,
    correct,
    durationMs: GetElapsedMilliseconds(
      attemptStartedAtSeconds === null ? null : attemptStartedAtSeconds * 1000,
      endedAtSeconds * 1000,
    ),
  };
}

export function ResolveSimonAttempt(lives: number, correct: boolean) {
  const livesRemaining = correct ? lives : Math.max(0, lives - 1);
  return {
    livesRemaining,
    replaySequence: !correct && livesRemaining > 0,
    gameOver: !correct && livesRemaining === 0,
  };
}

export function CreateSimonState(
  difficulty: Difficulty,
  configuredLives: number,
  random: () => number = Math.random,
): SimonState {
  const lives = [1, 3, 5].includes(configuredLives) ? configuredLives : 3;
  return {
    kind: 'simon-says',
    sequence: [Math.floor(random() * 4)],
    inputIndex: 0,
    litIndex: null,
    litStartedAt: null,
    showIndex: 0,
    nextStepAt: 0.35,
    targetRounds: [5, 7, 9][GetDifficultyIndex(difficulty)],
    status: 'showing',
    lives,
    maxLives: lives,
    attemptStartedAt: null,
    pressedIndex: null,
    pressedStartedAt: null,
    trials: [],
    moves: 0,
    errors: 0,
  };
}

export function HandleSimonTap(
  state: SimonState,
  index: number,
  elapsed: number,
  random: () => number = Math.random,
): SimonTapResult {
  const ignored: SimonTapResult = {
    accepted: false,
    trial: null,
    gameResult: null,
    replaySequence: false,
  };
  if (state.status !== 'input' || index < 0 || index > 3) return ignored;
  state.pressedIndex = index;
  state.pressedStartedAt = elapsed;
  if (state.sequence[state.inputIndex] !== index) {
    const trial = CreateSimonTrialRecord(
      state.trials.length + 1,
      state.sequence.length,
      false,
      state.attemptStartedAt,
      elapsed,
    );
    const resolution = ResolveSimonAttempt(state.lives, false);
    state.trials.push(trial);
    state.errors += 1;
    state.lives = resolution.livesRemaining;
    state.inputIndex = 0;
    state.attemptStartedAt = null;
    if (resolution.gameOver) {
      state.status = 'ended';
      return { accepted: true, trial, gameResult: 'Defeat', replaySequence: false };
    }
    state.status = 'showing';
    state.showIndex = 0;
    state.litIndex = null;
    state.litStartedAt = null;
    state.nextStepAt = elapsed + 0.35;
    return { accepted: true, trial, gameResult: null, replaySequence: true };
  }
  state.moves += 1;
  state.inputIndex += 1;
  if (state.inputIndex < state.sequence.length) {
    return { ...ignored, accepted: true };
  }
  const trial = CreateSimonTrialRecord(
    state.trials.length + 1,
    state.sequence.length,
    true,
    state.attemptStartedAt,
    elapsed,
  );
  state.trials.push(trial);
  state.attemptStartedAt = null;
  if (state.sequence.length >= state.targetRounds) {
    return { accepted: true, trial, gameResult: 'Victory', replaySequence: false };
  }
  state.sequence.push(Math.floor(random() * 4));
  state.status = 'showing';
  state.showIndex = 0;
  state.litIndex = null;
  state.litStartedAt = null;
  state.nextStepAt = elapsed + 0.35;
  return { accepted: true, trial, gameResult: null, replaySequence: false };
}

export function CompleteTimedOutSimonAttempt(state: SimonState, elapsed: number): SimonTrialRecord | null {
  if (state.status !== 'input') return null;
  const trial = CreateSimonTrialRecord(
    state.trials.length + 1,
    state.sequence.length,
    false,
    state.attemptStartedAt,
    elapsed,
  );
  state.trials.push(trial);
  state.errors += 1;
  state.status = 'ended';
  state.inputIndex = 0;
  state.attemptStartedAt = null;
  return trial;
}

function GetDifficultyIndex(difficulty: Difficulty) {
  if (difficulty === 'Beginner') return 0;
  if (difficulty === 'Intermediate') return 1;
  return 2;
}
