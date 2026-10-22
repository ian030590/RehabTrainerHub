import { SummarizeMemory, type PairsMatch } from './logic/memoryMatch';

export function BuildGameScore(match: PairsMatch, durationMs: number) {
  const rounds = match.turns.map(turn => ({ move: turn.move, thinkMs: turn.thinkMs, matched: turn.matched, matchedPairs: turn.matchedPairs }));
  return { schema: 'rehab-trainer.game-score/v1', gameId: 'memory-match', summary: { ...SummarizeMemory(match, durationMs) }, rounds };
}
