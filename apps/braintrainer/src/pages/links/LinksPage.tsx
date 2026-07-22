import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { t } = useT();

  const links = [
    { href: siteUrls.hub, title: t('links.hub.title'), description: t('links.hub.desc') },
    { href: siteUrls.motor, title: t('links.motor.title'), description: t('links.motor.desc') },
    { href: siteUrls.vision, title: t('links.vision.title'), description: t('links.vision.desc') },
    { href: siteUrls.mouth, title: 'MouthTrainer', description: '口說、理解與口腔動作訓練平台。' },
  ];

  return (
    <RelatedLinksGridPage
      title={t('links.title')}
      subtitle={t('links.subtitle')}
      links={links}
    />
  );
}
