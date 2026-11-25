import type { Metadata } from 'next';
import { GetTrainerCategoryTheme, trainerCategoryTags, trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import activityMap from '../../recommendation/generated/activityMap.json';
import featureIndex from '../../recommendation/generated/featureIndex.json';
import { GetActivityFeatures } from '../activities/activityFeatures';
import { BuildActivityLink } from '../activityLinks';
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

  const entries: ActivityMapEntry[] = [];
  for (const module of trainingCatalog) {
    const id = module.runtimeId;
    const point = points.get(id);
    const features = GetActivityFeatures(id);
    if (!point || !features || features.neighborIds.some(neighborId => neighborId === id || !points.has(neighborId))) return null;
    entries.push({ ...BuildActivityLink(module), ...features, category: module.trainer, point });
  }
  return entries;
}

export default function ActivityMapPage() {
  const categories = trainerCategoryTags.map(({ id, label }) => ({ id, label, style: BuildTrainingThemeStyle(GetTrainerCategoryTheme(id)) }));
  return <ActivityMap activities={BuildPublicActivities()} categories={categories} />;
}
