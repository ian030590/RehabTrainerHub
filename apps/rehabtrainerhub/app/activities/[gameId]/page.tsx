import { notFound } from 'next/navigation';
import { BuildHubTrainingHref, BuildTrainingGameInstallHref, GetTrainerCategoryTag, trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import { BuildActivityHref, BuildActivityLink } from '../../activityLinks';
import { zhTW } from '../../i18n';
import { CreatePageJsonLd, CreateSeoMetadata, SerializeJsonLd } from '../../seo';
import { ActivityDetails } from '../ActivityContent';
import { GetActivityFeatures, GetReviewedActivityDetails } from '../activityFeatures';

const modulesById = new Map(trainingCatalog.map(module => [module.runtimeId, module]));
type ActivityPageProps = { params: Promise<{ gameId: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return trainingCatalog.map(({ runtimeId }) => ({ gameId: runtimeId }));
}

export async function generateMetadata({ params }: ActivityPageProps) {
  const { gameId } = await params;
  const module = modulesById.get(gameId) ?? notFound();
  return CreateSeoMetadata({ ...module.copy['zh-TW'], path: BuildActivityHref(gameId) });
}

export default async function ActivityPage({ params }: ActivityPageProps) {
  const { gameId } = await params;
  const module = modulesById.get(gameId) ?? notFound();
  const category = GetTrainerCategoryTag(module.trainer);
  const features = GetActivityFeatures(gameId);
  if (!features || !category) throw new Error(`Missing activity data for ${gameId}`);
  const neighbors = features.neighborIds.map(id => {
    const neighbor = modulesById.get(id);
    if (!neighbor) throw new Error(`Unknown activity neighbor ${id} for ${gameId}`);
    return BuildActivityLink(neighbor);
  });
  const { activities, navigation } = zhTW.hubUi;
  const structuredData = CreatePageJsonLd({
    name: module.copy['zh-TW'].title, description: module.copy['zh-TW'].description, path: BuildActivityHref(gameId),
    breadcrumbs: [{ name: navigation.navigationItems[0], path: '/' }, { name: activities.title, path: '/activities/' }],
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SerializeJsonLd(structuredData) }} />
      <ActivityDetails copy={module.copy} category={category.label} mediaPermission={module.mediaPermission}
        reviewed={GetReviewedActivityDetails(gameId)}
        primaryTags={features.primaryTags} neighbors={neighbors} startHref={BuildHubTrainingHref(module)}
        installHref={BuildTrainingGameInstallHref(module)} />
    </>
  );
}
