import { gameDefinition, levels } from './logic/levels';
import { SummarizeSearch, type SearchRow } from './logic/searchScore';
import type { SearchTrial } from './logic/searchTrials';
import type { TrialOutcome } from './logic/trialRun';
import type { SearchSettings } from './settings';

export function ToRow(outcome: TrialOutcome<SearchTrial>, timeLimitMs: number, trialsPerBlock: number): SearchRow {
  const { trial } = outcome;
  const response = outcome.response === null ? null : Number(outcome.response);
  return { trial: (trial.block - 1) * trialsPerBlock + outcome.index + 1, block: trial.block, setSize: trial.setSize,
    present: Number(trial.present), targetSide: trial.targetQuadrant === null ? null : trial.targetQuadrant % 2,
    targetQuadrant: trial.targetQuadrant, response, correct: Number(response !== null && response === Number(trial.present)), rtMs: outcome.rtMs, timeLimitMs };
}

export function BuildGameScore(rows: readonly SearchRow[], settings: SearchSettings) {
  return { schema: 'rehab-trainer.game-score/v1' as const, gameId: gameDefinition.id,
    summary: SummarizeSearch(rows, levels[settings.level - 1].globalLevel), rounds: rows.map(row => ({ ...row })) };
}
