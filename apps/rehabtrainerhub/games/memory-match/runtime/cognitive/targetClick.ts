// Hub-owned target-click runtime.
import { CreateTargetTrialRecord } from './trialRecords';
import type { TargetTrialRecord,WhackState } from './types';
import { RandomBetween } from './utils';
export function ShowWhackTarget(state: WhackState, onsetMs: number) {
    if (state.activeIndex !== null)
        return false;
    state.activeIndex = Math.floor(Math.random() * state.gridSize * state.gridSize);
    state.targetStartedAt = onsetMs;
    state.targetExpiresAt = onsetMs + state.targetMs;
    return true;
}
export function ExpireWhackTarget(state: WhackState, nowMs: number): TargetTrialRecord | null {
    if (state.activeIndex === null)
        return null;
    const trial = CreateTargetTrialRecord(state.trials.length + 1, 'expired', state.targetStartedAt, nowMs, state.activeIndex, null);
    state.trials.push(trial);
    state.misses += 1;
    ScheduleNextTarget(state, nowMs);
    return trial;
}
function ScheduleNextTarget(state: WhackState, nowMs: number) {
    state.activeIndex = null;
    state.targetExpiresAt = null;
    state.targetStartedAt = null;
    state.nextTargetAt = nowMs + RandomBetween(state.minDelay, state.maxDelay) * 1000;
}
