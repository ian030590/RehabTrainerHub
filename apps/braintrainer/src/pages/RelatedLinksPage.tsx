import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
import { Icons } from '@rehab-trainer/ui/components/Icons';
import { useT } from '../i18n';
import { siteUrls } from '../utils/siteUrls';

export function RelatedLinksPage() {
  const { t } = useT();

  const links = [
    { href: siteUrls.hub, title: t('links.hub.title'), desc: t('links.hub.desc'), icon: <Icons.Hub /> },
    { href: siteUrls.stroke, title: t('links.stroke.title'), desc: t('links.stroke.desc'), icon: <Icons.AppTrainer /> },
    { href: siteUrls.vision, title: t('links.vision.title'), desc: t('links.vision.desc'), icon: <Icons.AppTrainer /> },
  ];

  return (
    <main className="page-content" id="main-content">
      <h1 className="section-title fade-in-up">{t('links.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('links.subtitle')}</p>
      <section className="selection-grid content-grid-spaced" aria-label={t('links.title')}>
        {links.map((link) => (
          <ExternalLinkCard
            key={link.href}
            href={link.href}
            icon={link.icon}
            title={link.title}
            description={link.desc}
            actionLabel={link.href.replace('https://', '')}
            actionIcon={<Icons.ExternalLink />}
          />
        ))}
      </section>
    </main>
  );
}
