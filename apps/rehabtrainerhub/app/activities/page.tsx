import { trainerCategoryTags, trainingCatalog } from '@rehab-trainer/hub-modules/catalog';
import { BuildActivityLink } from '../activityLinks';
import { zhTW } from '../i18n';
import { CreateSeoMetadata } from '../seo';
import { ActivityDirectory } from './ActivityContent';

const copy = zhTW.hubUi.activities;
export const metadata = CreateSeoMetadata({ title: copy.title, description: copy.description, path: '/activities/' });

export default function ActivitiesPage() {
  const groups = trainerCategoryTags.map(({ id, label }) => ({
    id, label, activities: trainingCatalog.filter(module => module.trainer === id).map(BuildActivityLink),
  }));
  return <ActivityDirectory groups={groups} />;
}
