import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT } from '../i18n';

export function ReferencesPage() {
  const { t } = useT();

  return (
    <GridPageLayout title={t('references.title')} subtitle={t('references.subtitle')}>
      <ExternalLinkCard
        href="https://github.com/rbcavanaugh/mainConcept"
        icon={<Icons.MainConcept />}
        title={t('references.mainConcept.title')}
        description={t('references.mainConcept.desc')}
        actionLabel="rbcavanaugh/mainConcept"
        actionIcon={<Icons.Github />}
      />
    </GridPageLayout>
  );
}
