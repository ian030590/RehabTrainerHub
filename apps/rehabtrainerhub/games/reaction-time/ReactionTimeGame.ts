export type ReactionDifficulty = 'easy' | 'medium' | 'hard';
export type ReactionStatus = 'waiting' | 'ready' | 'go' | 'result' | 'too-early';

export interface ReactionTrialRecord {
  trialNumber: number;
  outcome: 'success' | 'false-start';
  reactionTimeMs: number;
}

export interface ReactionState {
  status: ReactionStatus;
  targetTrials: number;
  trials: ReactionTrialRecord[];
  attempts: number[];
  falseStarts: number;
  waitStartedAt: number | null;
  goStartedAt: number | null;
  lastReactionMs: number | null;
}

const waitRangeMs: Record<ReactionDifficulty, readonly [number, number]> = {
  easy: [1400, 3200],
  medium: [1800, 4400],
  hard: [2200, 5200],
};

export function CreateReactionState(targetTrials: number): ReactionState {
  return {
    status: 'waiting',
    targetTrials,
    trials: [],
    attempts: [],
    falseStarts: 0,
    waitStartedAt: null,
    goStartedAt: null,
    lastReactionMs: null,
  };
}

export function StartReactionAttempt(
  state: ReactionState,
  difficulty: ReactionDifficulty,
  nowMs: number,
  random = Math.random,
): number | null {
  if (state.status !== 'waiting' && state.status !== 'result' && state.status !== 'too-early') return null;
  const [minimum, maximum] = waitRangeMs[difficulty];
  const delayMs = Math.round(minimum + random() * (maximum - minimum));
  state.status = 'ready';
  state.waitStartedAt = nowMs;
  state.goStartedAt = null;
  state.lastReactionMs = null;
  return delayMs;
}

export function ShowReactionGo(state: ReactionState): boolean {
  if (state.status !== 'ready') return false;
  state.status = 'go';
  return true;
}

export function MarkReactionGoVisible(state: ReactionState, nowMs: number): boolean {
  if (state.status !== 'go' || state.goStartedAt !== null) return false;
  state.goStartedAt = nowMs;
  return true;
}

export function HandleReactionTap(state: ReactionState, nowMs: number): ReactionTrialRecord | null {
  if (state.status !== 'ready' && (state.status !== 'go' || state.goStartedAt === null)) return null;
  const outcome = state.status === 'ready' ? 'false-start' : 'success';
  const startedAt = outcome === 'false-start' ? state.waitStartedAt : state.goStartedAt;
  const trial = {
    trialNumber: state.trials.length + 1,
    outcome,
    reactionTimeMs: Math.max(0, Math.round(nowMs - (startedAt ?? nowMs))),
  } satisfies ReactionTrialRecord;
  state.trials.push(trial);
  if (outcome === 'success') {
    state.attempts.push(trial.reactionTimeMs);
    state.lastReactionMs = trial.reactionTimeMs;
    state.status = 'result';
  } else {
    state.falseStarts += 1;
    state.status = 'too-early';
  }
  state.waitStartedAt = null;
  state.goStartedAt = null;
  return trial;
}

export function IsReactionAutoSuccess(state: ReactionState): boolean {
  return state.attempts.length >= state.targetTrials;
}

export function BuildReactionResultData(
  state: ReactionState,
  durationSec: number,
  result: 'Victory' | 'Defeat',
) {
  const meanMs = state.attempts.length
    ? Math.round(state.attempts.reduce((total, value) => total + value, 0) / state.attempts.length)
    : 0;
  return {
    details: {
      Game_Result: result,
      Total_Duration_Seconds: durationSec,
      Reaction_Trials: state.targetTrials,
      Reaction_Attempts: state.trials.length,
      Reaction_Successes: state.attempts.length,
      False_Starts: state.falseStarts,
      Reaction_Times_ms: state.attempts.join('|'),
      Average_Reaction_Time_ms: meanMs,
      Best_Reaction_Time_ms: state.attempts.length ? Math.min(...state.attempts) : 0,
    },
    detailRows: state.trials.map((trial) => ({
      trialNumber: trial.trialNumber,
      outcome: trial.outcome,
      reactionTimeMs: trial.reactionTimeMs,
      falseStart: trial.outcome === 'false-start' ? 1 : 0,
      responseMs: trial.outcome === 'success' ? trial.reactionTimeMs : null,
      earlyMs: trial.outcome === 'false-start' ? trial.reactionTimeMs : null,
    })),
  };
}
