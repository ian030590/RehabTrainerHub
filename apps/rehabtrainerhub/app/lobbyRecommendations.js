import { lobbySimilarityThreshold } from '../recommendation/features.js';
import { NormalizeActivityHistory } from './lobbyActivityHistory.js';

export { lobbySimilarityThreshold };

const recencyWeights = [1, 0.85, 0.7];
const recommendationLimit = 4;

export function RankLobbyRecommendations(history, featureIndex, launchableIds) {
  const recentIds = NormalizeActivityHistory(history, new Set(Object.keys(featureIndex.games)), recencyWeights.length)
    .map(({ gameId }) => gameId);
  if (!recentIds.length) return [];

  const { similarityScores } = featureIndex;
  const matches = [];
  for (const [gameId, catalogOrder] of new Map(launchableIds.map((id, order) => [id, order]))) {
    if (recentIds.includes(gameId) || !Object.hasOwn(featureIndex.games, gameId)) continue;
    let best = null;
    for (const [rank, reasonGameId] of recentIds.entries()) {
      const similarity = similarityScores[reasonGameId]?.[gameId] ?? similarityScores[gameId]?.[reasonGameId];
      if (similarity === undefined || similarity < lobbySimilarityThreshold) continue;
      const score = similarity * recencyWeights[rank];
      if (!best || score > best.score) best = { gameId, reasonGameId, score, catalogOrder };
    }
    if (best) matches.push(best);
  }
  return matches.sort((a, b) => b.score - a.score || a.catalogOrder - b.catalogOrder || a.gameId.localeCompare(b.gameId, 'en'))
    .slice(0, recommendationLimit)
    .map(({ gameId, reasonGameId, score }) => ({ gameId, reasonGameId, score }));
}

