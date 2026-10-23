// The exposure staircase from the legacy UFOV page: start at 500 ms, step down after a correct answer and three
// steps up after a miss; each reversal shrinks the step to three quarters, never below one display frame.
export const ufovTiming = {
  maxDurationMs: 500,
  startStepMs: 50,
  practiceTrials: 5,
  practiceDurationMs: 250,
  fixationMs: 1000,
  maskMs: 500,
  adaptiveMaxTrials: 60,
} as const;

export interface AdaptiveState {
  direction: 'up' | 'down' | null;
  stepMs: number;
  reversals: number[];
  limitStreak: number;
  failAtMaxStreak: number;
}

export function InitialAdaptiveState(): AdaptiveState {
  return { direction: null, stepMs: ufovTiming.startStepMs, reversals: [], limitStreak: 0, failAtMaxStreak: 0 };
}

export function UpdateAdaptiveState(state: AdaptiveState, correct: boolean, currentMs: number, refreshMs: number, maxMs: number): AdaptiveState {
  const direction = correct ? 'down' : 'up';
  const reversed = state.direction !== null && state.direction !== direction;
  const atMinimum = currentMs <= refreshMs * 1.25;
  const atMaximum = currentMs >= maxMs - refreshMs * .5;
  return {
    direction,
    stepMs: reversed ? Math.max(refreshMs, state.stepMs * .75) : state.stepMs,
    reversals: reversed ? [...state.reversals, currentMs] : state.reversals,
    limitStreak: (correct && atMinimum) || (!correct && atMaximum) ? state.limitStreak + 1 : 0,
    failAtMaxStreak: !correct && atMaximum ? state.failAtMaxStreak + 1 : 0,
  };
}

export function NextDurationMs(currentMs: number, correct: boolean, stepMs: number, minMs: number, maxMs: number) {
  return Math.min(maxMs, Math.max(minMs, currentMs + (correct ? -stepMs : stepMs * 3)));
}

export function MaxTestTrials(settings: { stopCondition: string; trialCount: number }) {
  return settings.stopCondition === 'fixed_trials' ? settings.trialCount : ufovTiming.adaptiveMaxTrials;
}

export function MsToFrameCount(durationMs: number, refreshMs: number) {
  const frameMs = Number.isFinite(refreshMs) && refreshMs > 0 ? refreshMs : 1000 / 60;
  return Math.max(1, Math.round(durationMs / frameMs));
}

export function FramesToMs(frames: number, refreshMs: number) {
  return frames * refreshMs;
}
