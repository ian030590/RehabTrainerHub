import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { t } = useT();

  const links = [
    {
      href: siteUrls.hub,
      icon: <Icons.Hub />,
      title: t('links.hub.title'),
      description: t('links.hub.desc'),
    },
    {
      href: siteUrls.stroke,
      icon: <Icons.AppTrainer />,
      title: t('links.strokeTrainer.title'),
      description: t('links.strokeTrainer.desc'),
    },
    {
      href: siteUrls.brain,
      icon: <Icons.AppTrainer />,
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
