import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT, type TranslationKey } from '../../i18n';

interface CreditItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  repo: string;
  url: string;
}

export function CreditsPage() {
  const { t } = useT();

  const credits: CreditItem[] = [
    {
      titleKey: 'credits.fract10.title',
      descKey: 'credits.fract10.desc',
      repo: 'michaelbach/FrACT10',
      url: 'https://github.com/michaelbach/FrACT10',
    },
    {
      titleKey: 'credits.eyeTraining.title',
      descKey: 'credits.eyeTraining.desc',
      repo: 'styts/eye-training',
      url: 'https://github.com/styts/eye-training',
    },
    {
      titleKey: 'credits.foveaflow.title',
      descKey: 'credits.foveaflow.desc',
      repo: 'Jesper-N/foveaflow',
      url: 'https://github.com/Jesper-N/foveaflow',
    },
    {
      titleKey: 'credits.gaborPatching.title',
      descKey: 'credits.gaborPatching.desc',
      repo: 'Fordi/gabor-patching',
      url: 'https://github.com/Fordi/gabor-patching',
    },
    {
      titleKey: 'credits.visiontherapy.title',
      descKey: 'credits.visiontherapy.desc',
      repo: 'visiontherapy/visiontherapy.github.io',
      url: 'https://github.com/visiontherapy/visiontherapy.github.io',
    },
  ];

  return (
    <GridPageLayout title={t('credits.title')} subtitle={t('credits.subtitle')}>
      {credits.map((credit, index) => (
        <ExternalLinkCard
          key={credit.url}
          href={credit.url}
          index={index + 1}
          title={t(credit.titleKey)}
          description={t(credit.descKey)}
          actionLabel={credit.repo}
          actionIcon={<Icons.Github />}
        />
      ))}
    </GridPageLayout>
  );
}
