import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

export function RelatedLinksPage() {
  const { t } = useT();

  const links = [
    { href: siteUrls.hub, title: t('links.hub.title'), description: t('links.hub.desc'), icon: <Icons.Hub /> },
    { href: siteUrls.stroke, title: t('links.stroke.title'), description: t('links.stroke.desc'), icon: <Icons.AppTrainer /> },
    { href: siteUrls.vision, title: t('links.vision.title'), description: t('links.vision.desc'), icon: <Icons.AppTrainer /> },
  ];

  return (
    <RelatedLinksGridPage
      title={t('links.title')}
      subtitle={t('links.subtitle')}
      links={links}
    />
  );
}
