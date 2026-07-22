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
      href: siteUrls.stroke,
      title: t('links.strokeTrainer.title'),
      description: t('links.strokeTrainer.desc'),
    },
    {
      href: siteUrls.brain,
      title: t('links.brainTrainer.title'),
      description: t('links.brainTrainer.desc'),
    },
    {
      href: siteUrls.mouth,
      title: 'MouthTrainer',
      description: '口說、理解與口腔動作訓練平台。',
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
