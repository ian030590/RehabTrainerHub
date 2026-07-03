import React from 'react';
import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT, type TranslationKey } from '../../i18n';

interface CreditItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  repo: string;
  url: string;
  icon: React.ReactNode;
}

export function CreditsPage() {
  const { t } = useT();

  const credits: CreditItem[] = [
    {
      titleKey: 'credits.javascriptGames.title',
      descKey: 'credits.javascriptGames.desc',
      repo: 'muthuspark/javascript-games',
      url: 'https://github.com/muthuspark/javascript-games',
      icon: <Icons.JavascriptGames />,
    },
    {
      titleKey: 'credits.vueMinesweeper.title',
      descKey: 'credits.vueMinesweeper.desc',
      repo: 'antfu/vue-minesweeper',
      url: 'https://github.com/antfu/vue-minesweeper',
      icon: <Icons.VueMinesweeper />,
    },
    {
      titleKey: 'credits.mainConcept.title',
      descKey: 'credits.mainConcept.desc',
      repo: 'rbcavanaugh/mainConcept',
      url: 'https://github.com/rbcavanaugh/mainConcept',
      icon: <Icons.MainConcept />,
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
