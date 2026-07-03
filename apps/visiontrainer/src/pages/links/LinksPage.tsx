import type { ReactNode } from 'react';
import { ExternalLinkCard } from '@rehab-trainer/ui/components/ExternalLinkCard';
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
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
      ),
    },
    {
      titleKey: 'links.strokeTrainer.title',
      descKey: 'links.strokeTrainer.desc',
      url: siteUrls.stroke,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
          <path d="M2 2l7.586 7.586" />
          <circle cx="11" cy="11" r="2" />
        </svg>
      ),
    },
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('links.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('links.subtitle')}</p>

      <div className="selection-grid content-grid-spaced">
        {links.map((link) => (
          <ExternalLinkCard
            key={link.url}
            href={link.url}
            icon={link.icon}
            title={t(link.titleKey)}
            description={t(link.descKey)}
            actionLabel={link.url.replace('https://', '')}
            actionIcon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          />
        ))}
      </div>
    </div>
  );
}
