import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { useT } from '../../i18n';

export function LowerLimbTraining() {
  const { t } = useT();

  return (
    <GridPageLayout
      title={t('home.module.lowerLimb.title')}
      subtitle={t('training.lowerLimb.subtitle')}
    />
  );
}
