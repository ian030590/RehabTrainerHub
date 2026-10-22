import type { ReactionRow } from './reactionTrials';

export interface ReactionSummary {
  duration: number; attempts: number; successes: number; falseStarts: number;
  meanMs: number | null; medianMs: number | null; bestMs: number | null; sdMs: number | null;
}

// Times come from timed presses only; false starts are counted but have no response time.
export function SummarizeReaction(rows: ReactionRow[], durationSec: number): ReactionSummary {
  const times = rows.filter(row => !row.falseStart).map(row => row.responseMs!);
  const ordered = [...times].sort((left, right) => left - right);
  const count = times.length;
  const mean = count ? times.reduce((sum, value) => sum + value, 0) / count : null;
  return {
    duration: Math.round(durationSec * 10) / 10,
    attempts: rows.length,
    successes: count,
    falseStarts: rows.length - count,
    meanMs: mean === null ? null : Math.round(mean),
    medianMs: count ? Math.round((ordered[Math.floor((count - 1) / 2)] + ordered[Math.floor(count / 2)]) / 2) : null,
    bestMs: count ? ordered[0] : null,
    sdMs: count > 1 && mean !== null ? Math.round(Math.sqrt(times.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (count - 1))) : null,
  };
}
