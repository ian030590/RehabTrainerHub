import { RelatedLinksGridPage } from '@rehab-trainer/ui/components/RelatedLinksGridPage';
import { useT } from '../../i18n';
import { siteUrls } from '../../utils/siteUrls';

export function LinksPage() {
  const { t } = useT();
  return <RelatedLinksGridPage title={t('nav.links')} subtitle={t('links.subtitle')} links={[
    { href: siteUrls.hub, title: t('links.hub.title'), description: t('links.hub.desc') },
    { href: siteUrls.motor, title: t('mouth.links.motor.title'), description: t('mouth.links.motor.desc') },
    { href: siteUrls.vision, title: t('mouth.links.vision.title'), description: t('mouth.links.vision.desc') },
    { href: siteUrls.brain, title: t('mouth.links.brain.title'), description: t('mouth.links.brain.desc') },
  ]} />;
}
