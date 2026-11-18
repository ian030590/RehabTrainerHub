import type { Scenario, Settings } from './settings.js';
import { Simulate } from './physics.js';

export type Row = {
  scenario: Scenario;
  r: number;
  gap: number;
  falseStarts: number;
  timedOut: boolean;
  answered: number;
  outcome: ReturnType<typeof Simulate>;
};

const scenarioCode = { plain: 0, 'swerve-away': 1, 'out-and-back': 2 } as const;

export function BuildResult(config: Settings, rows: readonly Row[]) {
  const scored = rows.slice(0, 5);
  const avg = scored.reduce((sum, row) => sum + row.r, 0) / 5;
  const distraction = rows[5];
  const difference = distraction.answered > 0 ? distraction.r - avg : null;
  return { config, score: { schema: 'rehab-trainer.game-score/v1', gameId: 'brake-reaction',
    summary: {
      avg, best: Math.min(...scored.map(row => row.r)),
      falseStarts: rows.reduce((sum, row) => sum + row.falseStarts, 0),
      lateCount: scored.filter(row => row.outcome.contact).length,
      distractionAnswered: distraction.answered,
      distractionDeltaSeconds: difference,
      distractionDeltaMeters: difference === null ? null : difference * config.speedKmh / 3.6,
    },
    rounds: rows.map(row => ({
      r: row.r, scenario: scenarioCode[row.scenario], gap: row.gap, falseStarts: row.falseStarts,
      timedOut: Number(row.timedOut), contact: Number(row.outcome.contact),
      relativeKmh: row.outcome.rel, beforeBraking: row.outcome.beforeBraking,
      remainingMeters: row.outcome.contact ? null : row.outcome.remaining,
    })),
  } };
}
