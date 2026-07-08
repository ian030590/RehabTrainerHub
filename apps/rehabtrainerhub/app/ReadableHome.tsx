'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useHubReadability } from './HubNavigation';
import { HUB_NAME } from './hubBrand';
import { siteUrls } from './siteUrls';
import { zhTW, en as enTranslations } from './i18n';
import type { HubLocale } from './i18n/types';

type IconName = 'arrow' | 'check' | 'panel';

const content: { [K in HubLocale]: typeof zhTW.home | typeof enTranslations.home } = {
  'zh-TW': zhTW.home,
  en: enTranslations.home,
};

const appAssets = {
  stroke: {
    href: siteUrls.stroke,
    image: '/assets/stroke-logo.svg',
  },
  vision: {
    href: siteUrls.vision,
    image: '/assets/vision-logo.svg',
  },
} as const;

function Icon({ name, className }: { name: IconName; className?: string }) {
  if (name === 'panel') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M7 9h10M7 13h4m3 0h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'check') {
    return (
      <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg className={className} aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ReadableHome() {
  const { locale } = useHubReadability();
  const copy = content[locale];

  return (
    <main className="home-page" id="top">
      <section className="hero">
        <div className="section-inner hero-grid">
          <div className="hero-copy">
            <p className="eyebrow pill">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.title}</h1>
            <p>{copy.hero.body}</p>
            <div className="hero-actions">
              <a className="primary-action" href="#apps-title">
                {copy.hero.primaryAction}
              </a>
              <a className="secondary-action" href="#care-title">
                {copy.hero.secondaryAction}
              </a>
            </div>
          </div>

          <div className="hero-panel" aria-label={copy.hero.visualLabel}>
            <div className="hero-device">
              <div className="device-topbar" aria-hidden="true">
                <Icon className="icon-sm" name="panel" />
                <span>{HUB_NAME}</span>
              </div>
              <div className="device-content">
                {copy.apps.map((app) => {
                  const asset = appAssets[app.id];
                  return (
                    <div className={`device-tile device-tile-${app.id}`} key={app.id}>
                      <Image className="device-logo" src={asset.image} alt={app.logoAlt} width={96} height={64} />
                      <span>{app.localTitle}</span>
                    </div>
                  );
                })}
              </div>
              <div className="hero-checklist">
                {copy.hero.checklist.map((item) => (
                  <span key={item}>
                    <Icon className="check-icon" name="check" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-section" id="programs" aria-labelledby="apps-title">
        <div className="section-inner">
          <div className="section-heading">
            <p className="eyebrow">{copy.programs.eyebrow}</p>
            <h2 id="apps-title">{copy.programs.title}</h2>
            <p>{copy.programs.intro}</p>
          </div>

          <div className="app-grid">
            {copy.apps.map((app) => {
              const asset = appAssets[app.id];
              return (
                <article className={`app-card app-card-${app.id}`} key={app.id}>
                  <div className="app-card-heading">
                    <div>
                      <span>{app.name}</span>
                      <h3>{app.localTitle}</h3>
                    </div>
                    <div className="app-icon">
                      <Image className="app-logo" src={asset.image} alt={app.logoAlt} width={86} height={54} />
                    </div>
                  </div>

                  <p className="app-best-for">{app.bestFor}</p>
                  <p className="app-description">{app.description}</p>

                  <ul className="app-points">
                    {app.points.map((point) => (
                      <li key={point}>
                        <Icon className="check-icon" name="check" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>

                  <a className="app-link" href={asset.href}>
                    {app.action}
                    <Icon className="icon-sm" name="arrow" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="care-section" id="care" aria-labelledby="care-title">
        <div className="section-inner care-grid">
          <div className="care-copy">
            <p className="eyebrow">{copy.care.eyebrow}</p>
            <h2 id="care-title">{copy.care.title}</h2>
            <blockquote>{copy.care.quote}</blockquote>
            <p>{copy.care.body}</p>
          </div>

          <div className="safety-list">
            {copy.safetySteps.map((card, index) => (
              <article className="feature-card" key={card.title}>
                <span aria-hidden="true">{index + 1}</span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="education-section" id="education" aria-labelledby="education-title">
        <div className="education-card">
          <p className="eyebrow">{copy.education.eyebrow}</p>
          <h2 id="education-title">{copy.education.title}</h2>
          <p>{copy.education.intro}</p>
          <div className="section-links">
            <Link className="primary-action" href="/education/">
              {copy.education.educationLink}
            </Link>
            <Link className="text-link" href="/videos/">
              {copy.education.linksLink}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
