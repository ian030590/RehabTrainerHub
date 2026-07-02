import React from 'react';
import { ExternalLinkCard } from '../../components/ExternalLinkCard';
import { useT, type TranslationKey } from '../../i18n';

interface CreditItem {
  titleKey: TranslationKey;
  descKey: TranslationKey;
  repo: string;
  url: string;
  icon: React.ReactNode;
}

export function CreditsPage() {
  const { t } = useT();

  const credits: CreditItem[] = [
    {
      titleKey: 'credits.javascriptGames.title',
      descKey: 'credits.javascriptGames.desc',
      repo: 'muthuspark/javascript-games',
      url: 'https://github.com/muthuspark/javascript-games',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2" ry="2" />
          <path d="M6 12h4m-2-2v4m8-2h.01M16 12h.01" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.vueMinesweeper.title',
      descKey: 'credits.vueMinesweeper.desc',
      repo: 'antfu/vue-minesweeper',
      url: 'https://github.com/antfu/vue-minesweeper',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>
      ),
    },
    {
      titleKey: 'credits.mainConcept.title',
      descKey: 'credits.mainConcept.desc',
      repo: 'rbcavanaugh/mainConcept',
      url: 'https://github.com/rbcavanaugh/mainConcept',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 5h16" />
          <path d="M4 12h10" />
          <path d="M4 19h16" />
          <path d="M17 9h3v3" />
          <path d="m20 9-5 5" />
        </svg>
      ),
    },
  ];

  return (
    <div className="page-content">
      <h1 className="section-title fade-in-up">{t('credits.title')}</h1>
      <p className="section-subtitle fade-in-up">{t('credits.subtitle')}</p>

      <div className="training-grid content-grid-spaced">
        {credits.map((credit) => (
          <ExternalLinkCard
            key={credit.url}
            href={credit.url}
            icon={credit.icon}
            title={t(credit.titleKey)}
            description={t(credit.descKey)}
            actionLabel={credit.repo}
            actionIcon={(
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
            )}
          />
        ))}
      </div>
    </div>
  );
}
