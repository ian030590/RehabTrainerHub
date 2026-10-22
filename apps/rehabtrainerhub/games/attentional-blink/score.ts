import { SummarizeBlink, type BlinkRow } from './logic/blink';

export function BuildGameScore(rows: BlinkRow[]) {
  const rounds = rows.map(row => ({ trial: row.trial, lag: row.lag, t1Position: row.t1Position, t1: row.t1, t2: row.t2,
    t1Response: row.t1Response, t2Response: row.t2Response, t1Correct: Number(row.t1Correct), t2Correct: Number(row.t2Correct) }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'attentional-blink', summary: { ...SummarizeBlink(rows) }, rounds };
}
