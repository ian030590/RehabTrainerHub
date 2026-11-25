import featureIndex from '../../recommendation/generated/featureIndex.json';
import gameFeatures from '../../recommendation/gameFeatures.json';
import taxonomy from '../../recommendation/taxonomy.json';
import type { HubLabel } from '../i18n/types';

const profiles = new Map(Object.entries(gameFeatures.games));
const indexed = new Map(Object.entries(featureIndex.games));
const capabilityLabels = Object.fromEntries(taxonomy.capabilities.map(({ id, labels }) => [id, labels]));

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

export function GetReviewedActivityDetails(id: string) {
  const profile = profiles.get(id);
  if (profile?.reviewStatus !== 'confirmed') return null;

  const evidence = new Map(Object.entries(profile.evidence));
  const content = taxonomy.tags.flatMap(tag => {
    const sentence = evidence.get(tag.id);
    return sentence ? [{ label: tag.labels, text: { 'zh-TW': sentence, en: tag.definition.en } }] : [];
  });
  const levels = new Map(Object.entries(profile.taskDemandTags));
  const demands = taxonomy.dimensions.filter(dimension => dimension.group === 'taskDemand').flatMap(dimension => {
    const tags = taxonomy.tags.filter(tag => tag.dimension === dimension.id && levels.get(tag.id) === 2);
    return tags.length ? [{ label: dimension.labels, values: tags.map(tag => tag.labels) }] : [];
  });
  const setups = new Map<string, HubLabel[]>();
  for (const { allCapabilities } of profile.supportedSetups) {
    const ids = [...new Set(allCapabilities)];
    const key = [...ids].sort().join('+');
    if (!setups.has(key)) setups.set(key, ids.map(id => capabilityLabels[id]));
  }
  return { content, demands, setups: [...setups.values()] };
}
