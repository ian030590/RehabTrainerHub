import type { TargetTrialOutcome,TargetTrialRecord } from './types';
export function GetElapsedMilliseconds(startMs: number | null, endMs: number) {
    if (startMs === null || !Number.isFinite(startMs) || !Number.isFinite(endMs))
        return 0;
    return Math.max(0, Math.round(endMs - startMs));
}
export function CreateTargetTrialRecord(trialNumber: number, outcome: TargetTrialOutcome, startMs: number | null, endMs: number, targetIndex: number | null, tappedIndex: number | null): TargetTrialRecord {
    return {
        trialNumber,
        outcome,
        reactionTimeMs: GetElapsedMilliseconds(startMs, endMs),
        targetIndex,
        tappedIndex,
    };
}
