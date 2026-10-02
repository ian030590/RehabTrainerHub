import type { Difficulty, TargetTrialRecord, WhackState, WhackTapResult } from './runtime/cognitive/types';

const whackConfig = {
  Beginner: { gridSize: 3, targetMs: 1100, minDelay: 0.35, maxDelay: 0.9 },
  Intermediate: { gridSize: 3, targetMs: 850, minDelay: 0.25, maxDelay: 0.72 },
  Advanced: { gridSize: 4, targetMs: 720, minDelay: 0.18, maxDelay: 0.58 },
} satisfies Record<Difficulty, { gridSize: number; targetMs: number; minDelay: number; maxDelay: number }>;

export function CreateWhackState(difficulty: Difficulty): WhackState {
  const config = whackConfig[difficulty];
  return {
    kind: 'whack-a-mole',
    ...config,
    activeIndex: null,
    previousIndex: null,
    nextTargetAt: performance.now() + 600,
    targetExpiresAt: null,
    targetStartedAt: null,
    hits: 0,
    misses: 0,
    taps: 0,
    hitReactionMs: [],
    trials: [],
  };
}

function CreateTrial(state: WhackState, outcome: TargetTrialRecord['outcome'], nowMs: number, tappedIndex: number | null): TargetTrialRecord {
  return {
    trialNumber: state.trials.length + 1,
    outcome,
    reactionTimeMs: Math.max(0, Math.round(nowMs - (state.targetStartedAt ?? nowMs))),
    targetIndex: state.activeIndex,
    tappedIndex,
  };
}

function ScheduleNextTarget(state: WhackState, nowMs: number) {
  state.previousIndex = state.activeIndex;
  state.activeIndex = null;
  state.targetExpiresAt = null;
  state.targetStartedAt = null;
  state.nextTargetAt = nowMs + (state.minDelay + Math.random() * (state.maxDelay - state.minDelay)) * 1000;
}

export function ShowWhackTarget(state: WhackState, onsetMs: number) {
  if (state.activeIndex !== null) return false;
  const total = state.gridSize * state.gridSize;
  const choice = Math.floor(Math.random() * (total - 1));
  state.activeIndex = state.previousIndex === null || choice < state.previousIndex ? choice : choice + 1;
  state.targetStartedAt = onsetMs;
  state.targetExpiresAt = onsetMs + state.targetMs;
  return true;
}

export function HandleWhackTap(state: WhackState, index: number, tapMs: number): WhackTapResult | null {
  if (state.activeIndex === null) return null;
  if (tapMs >= (state.targetExpiresAt ?? 0)) {
    const trial = ExpireWhackTarget(state, state.targetExpiresAt ?? tapMs);
    return trial ? { trial, targetCompleted: true } : null;
  }
  state.taps += 1;
  const trial = CreateTrial(state, state.activeIndex === index ? 'hit' : 'wrong-tap', tapMs, index);
  state.trials.push(trial);
  if (trial.outcome === 'hit') {
    state.hits += 1;
    state.hitReactionMs.push(trial.reactionTimeMs);
  } else {
    state.misses += 1;
  }
  ScheduleNextTarget(state, tapMs);
  return { trial, targetCompleted: true };
}

export function ExpireWhackTarget(state: WhackState, nowMs: number): TargetTrialRecord | null {
  if (state.activeIndex === null) return null;
  const trial = CreateTrial(state, 'expired', nowMs, null);
  state.trials.push(trial);
  state.misses += 1;
  ScheduleNextTarget(state, nowMs);
  return trial;
}

export function IsWhackAutoSuccess(state: WhackState) {
  return state.hits > 0;
}

export function BuildWhackResultData(state: WhackState, durationSec: number, gameResult: 'Victory' | 'Defeat') {
  const averageMs = state.hitReactionMs.length
    ? Math.round(state.hitReactionMs.reduce((sum, value) => sum + value, 0) / state.hitReactionMs.length)
    : 0;
  return {
    details: {
      Game_Result: gameResult,
      Total_Duration_Seconds: durationSec,
      Target_Click_Hits: state.hits,
      Target_Click_Misses: state.misses,
      Target_Click_Taps: state.taps,
      Target_Click_Reaction_Times_ms: state.hitReactionMs.join('|'),
      Average_Target_Click_Reaction_Time_ms: averageMs,
      Best_Target_Click_Reaction_Time_ms: state.hitReactionMs.length ? Math.min(...state.hitReactionMs) : 0,
    },
    detailRows: state.trials.map((trial) => ({
      ...trial,
      outcomeCode: trial.outcome === 'hit' ? 1 : trial.outcome === 'expired' ? 2 : 3,
      responseMs: trial.outcome === 'hit' ? trial.reactionTimeMs : null,
    })),
  };
}
