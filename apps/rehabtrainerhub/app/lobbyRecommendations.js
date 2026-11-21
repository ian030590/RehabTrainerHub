import { lobbySimilarityThreshold } from '../recommendation/features.js';

export { lobbySimilarityThreshold };

// Weights follow play-count rank. Every played activity below third uses 0.6.
const topPlayWeights = [1, 0.85, 0.7];
const remainingPlayWeight = 0.6;

export function OrderLobbyGames(games, playCounts, similarityScores) {
  const countsById = new Map(playCounts.map(summary => [summary.gameId, summary]));
  const played = games.flatMap((game, catalogOrder) => {
    const summary = countsById.get(game.id);
    return summary ? [{ game, catalogOrder, ...summary }] : [];
  }).sort((a, b) => b.count - a.count
    || Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt)
    || a.catalogOrder - b.catalogOrder);
  const cues = new Map(played.map(({ game }) => [game.id, { tier: 'played' }]));
  if (played.length === 0) return { games, cues };

  const similar = [];
  const remaining = [];
  for (const [catalogOrder, game] of games.entries()) {
    if (cues.has(game.id)) continue;
    let best = null;
    for (const [rank, { gameId: reasonGameId }] of played.entries()) {
      const similarity = similarityScores[reasonGameId]?.[game.id] ?? similarityScores[game.id]?.[reasonGameId];
      if (!Number.isFinite(similarity) || similarity < lobbySimilarityThreshold) continue;
      const score = similarity * (topPlayWeights[rank] ?? remainingPlayWeight);
      if (!best || score > best.score) best = { tier: 'similar', reasonGameId, score };
    }
    if (best) {
      cues.set(game.id, best);
      similar.push({ game, catalogOrder, score: best.score });
    } else {
      remaining.push(game);
    }
  }
  similar.sort((a, b) => b.score - a.score || a.catalogOrder - b.catalogOrder || a.game.id.localeCompare(b.game.id, 'en'));
  return { games: [...played.map(({ game }) => game), ...similar.map(({ game }) => game), ...remaining], cues };
}
