import type { Metadata } from 'next';
import { BuildHubTrainingHref, GetTrainerCategoryTheme, trainerCategoryTags, trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import activityMap from '../../recommendation/generated/activityMap.json';
import featureIndex from '../../recommendation/generated/featureIndex.json';
import gameFeatures from '../../recommendation/gameFeatures.json';
import taxonomy from '../../recommendation/taxonomy.json';
import { zhTW } from '../i18n';
import { CreateSeoMetadata } from '../seo';
import { BuildTrainingThemeStyle } from '../trainingThemeStyle';
import { ActivityMap } from './ActivityMap';
import { ReadActivityMapPoints, type ActivityMapEntry } from './activityMapModel';

const copy = zhTW.hubUi.activityMap;

export const metadata: Metadata = CreateSeoMetadata({
  title: copy.title,
  description: copy.description,
  path: '/activity-map/',
});

function BuildPublicActivities(): ActivityMapEntry[] | null {
  const ids = trainingCatalog.map(({ runtimeId }) => runtimeId);
  if (activityMap.layoutVersion !== 1 || activityMap.featureInputSha256 !== featureIndex.inputSha256) return null;
  const points = ReadActivityMapPoints(activityMap.map, ids);
  if (!points) return null;

  const profiles = new Map(Object.entries(gameFeatures.games));
  const indexed = new Map(Object.entries(featureIndex.games));
  const entries: ActivityMapEntry[] = [];
  for (const module of trainingCatalog) {
    const id = module.runtimeId;
    const point = points.get(id);
    const profile = profiles.get(id);
    const similarity = indexed.get(id);
    if (!point || !profile || !similarity) return null;
    const levels = new Map(Object.entries(profile.functionTags));
    const primaryTags = taxonomy.tags.filter(tag => levels.get(tag.id) === 2).map(tag => tag.labels);
    const neighborIds = similarity.neighbors.slice(0, 3).map(({ gameId }) => gameId);
    if (neighborIds.some(neighborId => neighborId === id || !points.has(neighborId))) return null;
    entries.push({
      id, point, primaryTags, neighborIds,
      category: module.trainer,
      title: { 'zh-TW': module.copy['zh-TW'].title, en: module.copy.en.title },
      href: BuildHubTrainingHref(module),
    });
  }
  return entries;
}

export default function ActivityMapPage() {
  const categories = trainerCategoryTags.map(({ id, label }) => ({ id, label, style: BuildTrainingThemeStyle(GetTrainerCategoryTheme(id)) }));
  return <ActivityMap activities={BuildPublicActivities()} categories={categories} />;
}
