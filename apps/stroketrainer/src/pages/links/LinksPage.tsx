import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { t } = useT();

  const links = [
    {
      href: siteUrls.hub,
      title: t('links.hub.title'),
      description: t('links.hub.desc'),
    },
    {
      href: siteUrls.vision,
      title: t('links.visionTrainer.title'),
      description: t('links.visionTrainer.desc'),
    },
    {
      href: siteUrls.brain,
      title: t('links.brainTrainer.title'),
      description: t('links.brainTrainer.desc'),
    },
  ];

  return (
    <RelatedLinksGridPage
      title={t('links.title')}
      subtitle={t('links.subtitle')}
      links={links}
    />
  );
}
