import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { useT } from '../i18n';

export function ReferencesPage() {
  const { t } = useT();

  return (
    <GridPageLayout title={t('references.title')} subtitle={t('references.subtitle')} />
  );
}
