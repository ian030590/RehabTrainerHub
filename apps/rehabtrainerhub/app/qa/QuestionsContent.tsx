'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { EducationArticles } from './EducationArticles';

const personalWebsiteUrl = 'https://ian.trainerhub.cc/';

export function QuestionsContent() {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).questions;

  return (
    <main className="qa-page" id="main-content">
      <header className="page-heading">
        <h1>{copy.title}</h1>
      </header>

      <section className="about-site-section" aria-labelledby="about-site-title">
        <h2 id="about-site-title">{copy.aboutTitle}</h2>
        <p>{copy.aboutBody}</p>
      </section>

      <section
        className="about-site-section"
        aria-labelledby="professional-background-title"
        id="professional-background"
      >
        <h2 id="professional-background-title">{copy.professionalTitle}</h2>
        <p><strong>{copy.professionalName}</strong></p>
        <p>{copy.professionalBody}</p>
        <p className="professional-website-link">
          {copy.professionalWebsiteLabel}{' '}
          <a href={personalWebsiteUrl} rel="me">
            {copy.professionalWebsiteLink}
          </a>
        </p>
      </section>

      <EducationArticles />
    </main>
  );
}
