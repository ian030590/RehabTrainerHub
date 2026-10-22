import { IsCorrect, SummarizeAnt, type AntRow } from './logic/antScore';

const cueCodes = { nocue: 0, center: 1, double: 2, spatial: 3 } as const;
const conditionCodes = { neutral: 0, congruent: 1, incongruent: 2 } as const;
const SideCode = (side: 'left' | 'right' | null) => side === null ? null : side === 'left' ? 0 : 1;

export function BuildGameScore(rows: AntRow[], settings: { responseWindowMs: number }) {
  const rounds = rows.map(row => ({ trial: row.trial, practice: Number(row.practice), cue: cueCodes[row.cue], location: row.location === 'up' ? 0 : 1,
    condition: conditionCodes[row.condition], target: SideCode(row.target), response: SideCode(row.response), correct: Number(IsCorrect(row)),
    responseMs: row.rtMs, setting: settings.responseWindowMs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'attention-network-task', summary: { ...SummarizeAnt(rows) }, rounds };
}
