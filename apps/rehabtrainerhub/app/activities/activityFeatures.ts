import featureIndex from '../../recommendation/generated/featureIndex.json';
import gameFeatures from '../../recommendation/gameFeatures.json';
import taxonomy from '../../recommendation/taxonomy.json';

const profiles = new Map(Object.entries(gameFeatures.games));
const indexed = new Map(Object.entries(featureIndex.games));

export function GetActivityFeatures(id: string) {
  const profile = profiles.get(id);
  const similarity = indexed.get(id);
  if (!profile || !similarity) return null;
  const levels = new Map(Object.entries(profile.functionTags));
  return {
    primaryTags: taxonomy.tags.filter(tag => levels.get(tag.id) === 2).map(tag => tag.labels),
    neighborIds: similarity.neighbors.slice(0, 3).map(({ gameId }) => gameId),
  };
}
