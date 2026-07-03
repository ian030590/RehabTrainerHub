import type { ReactNode } from 'react';
import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT, type TranslationKey } from '../../i18n';

interface CreditItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  repo: string;
  url: string;
  icon: ReactNode;
}

export function CreditsPage() {
  const { t } = useT();

  const credits: CreditItem[] = [
    {
      titleKey: 'credits.fract10.title',
      descKey: 'credits.fract10.desc',
      repo: 'michaelbach/FrACT10',
      url: 'https://github.com/michaelbach/FrACT10',
      icon: <Icons.Fract10 />,
    },
    {
      titleKey: 'credits.eyeTraining.title',
      descKey: 'credits.eyeTraining.desc',
      repo: 'styts/eye-training',
      url: 'https://github.com/styts/eye-training',
      icon: <Icons.EyeTraining />,
    },
    {
      titleKey: 'credits.foveaflow.title',
      descKey: 'credits.foveaflow.desc',
      repo: 'Jesper-N/foveaflow',
      url: 'https://github.com/Jesper-N/foveaflow',
      icon: <Icons.Foveaflow />,
    },
    {
      titleKey: 'credits.gaborPatching.title',
      descKey: 'credits.gaborPatching.desc',
      repo: 'Fordi/gabor-patching',
      url: 'https://github.com/Fordi/gabor-patching',
      icon: <Icons.GaborPatching />,
    },
    {
      titleKey: 'credits.visiontherapy.title',
      descKey: 'credits.visiontherapy.desc',
      repo: 'visiontherapy/visiontherapy.github.io',
      url: 'https://github.com/visiontherapy/visiontherapy.github.io',
      icon: <Icons.VisionTherapy />,
    },
  ];

  return (
    <GridPageLayout title={t('credits.title')} subtitle={t('credits.subtitle')}>
      {credits.map((credit) => (
        <ExternalLinkCard
          key={credit.url}
          href={credit.url}
          icon={credit.icon}
          title={t(credit.titleKey)}
          description={t(credit.descKey)}
          actionLabel={credit.repo}
          actionIcon={<Icons.Github />}
        />
      ))}
    </GridPageLayout>
  );
}
