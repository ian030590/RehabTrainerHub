'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

const repositoryUrl = 'https://github.com/ian030590/RehabTrainerHub';
const issuesUrl = `${repositoryUrl}/issues`;

export function AboutContent() {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).about;

  return (
    <main className="qa-page about-page" id="main-content">
      <header className="page-heading">
        <p className="page-kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>

      <section className="about-site-section" aria-labelledby="about-purpose-title">
        <p className="page-kicker">{copy.purposeKicker}</p>
        <h2 id="about-purpose-title">{copy.purposeTitle}</h2>
        <p>{copy.purposeBody}</p>
      </section>

      <section className="about-site-section" aria-labelledby="about-platform-title">
        <p className="page-kicker">{copy.platformKicker}</p>
        <h2 id="about-platform-title">{copy.platformTitle}</h2>
        <p>{copy.platformBody}</p>
      </section>

      <section className="about-site-section" aria-labelledby="about-responsibility-title">
        <p className="page-kicker">{copy.responsibilityKicker}</p>
        <h2 id="about-responsibility-title">{copy.responsibilityTitle}</h2>
        <p>{copy.responsibilityBody}</p>
        <p><a href="/qa/#professional-background">{copy.responsibilityLink}</a></p>
      </section>

      <section
        className="about-site-section"
        aria-labelledby="about-contact-title"
        id="contact"
      >
        <p className="page-kicker">{copy.contactKicker}</p>
        <h2 id="about-contact-title">{copy.contactTitle}</h2>
        <p>{copy.contactBody}</p>
        <p>
          <a href={repositoryUrl} rel="noopener noreferrer" target="_blank">
            {copy.repositoryLink}
          </a>
          {' · '}
          <a href={issuesUrl} rel="noopener noreferrer" target="_blank">
            {copy.issuesLink}
          </a>
        </p>
      </section>

      <p className="about-page-updated">{copy.updated}</p>
    </main>
  );
}
