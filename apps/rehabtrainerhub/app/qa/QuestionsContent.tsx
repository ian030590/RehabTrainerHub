'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { EducationArticles } from './EducationArticles';

export function QuestionsContent() {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).questions;

  return (
    <main className="qa-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
      </header>

      <section className="about-site-section" aria-labelledby="about-site-title">
        <p className="page-kicker">{copy.aboutKicker}</p>
        <h2 id="about-site-title">{copy.aboutTitle}</h2>
        <p>{copy.aboutBody}</p>
      </section>

      <section
        className="about-site-section"
        aria-labelledby="professional-background-title"
        id="professional-background"
      >
        <p className="page-kicker">{copy.professionalKicker}</p>
        <h2 id="professional-background-title">{copy.professionalTitle}</h2>
        <p>{copy.professionalBody}</p>
      </section>

      <EducationArticles />
    </main>
  );
}
