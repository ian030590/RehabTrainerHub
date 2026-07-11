import type { ReactNode } from 'react';
import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { GridPageLayout } from '@rehab-trainer/ui/components/GridPageLayout';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT, type TranslationKey } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

interface LinkItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  url: string;
  icon: ReactNode;
}

export function LinksPage() {
  const { t } = useT();

  const links: LinkItem[] = [
    {
      titleKey: 'links.hub.title',
      descKey: 'links.hub.desc',
      url: siteUrls.hub,
      icon: <Icons.Hub />,
    },
    {
      titleKey: 'links.visionTrainer.title',
      descKey: 'links.visionTrainer.desc',
      url: siteUrls.vision,
      icon: <Icons.AppTrainer />,
    },
    {
      titleKey: 'links.brainTrainer.title',
      descKey: 'links.brainTrainer.desc',
      url: siteUrls.brain,
      icon: <Icons.AppTrainer />,
    },
  ];

  return (
    <GridPageLayout title={t('links.title')} subtitle={t('links.subtitle')}>
      {links.map((link) => (
        <ExternalLinkCard
          key={link.url}
          href={link.url}
          icon={link.icon}
          title={t(link.titleKey)}
          description={t(link.descKey)}
          actionLabel={link.url.replace('https://', '')}
          actionIcon={<Icons.ExternalLink />}
        />
      ))}
    </GridPageLayout>
  );
}
