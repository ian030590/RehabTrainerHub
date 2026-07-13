import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { t } = useT();

  const links = [
    { href: siteUrls.hub, title: t('links.hub.title'), description: t('links.hub.desc') },
    { href: siteUrls.stroke, title: t('links.stroke.title'), description: t('links.stroke.desc') },
    { href: siteUrls.vision, title: t('links.vision.title'), description: t('links.vision.desc') },
  ];

  return (
    <RelatedLinksGridPage
      title={t('links.title')}
      subtitle={t('links.subtitle')}
      links={links}
    />
  );
}
