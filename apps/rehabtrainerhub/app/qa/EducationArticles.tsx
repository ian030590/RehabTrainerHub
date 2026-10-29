'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';

export function EducationArticles() {
  const { language } = useHubLanguage();
  const copy = GetHubUiCopy(language).educationArticles;

  return (
    <section className="education-articles-section" aria-labelledby="education-articles-title">
      <header className="section-title-row">
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h2 id="education-articles-title">{copy.title}</h2>
        </div>
      </header>
      <p className="education-articles-source">{copy.sourceNote}</p>
      <p className="professional-website-link">
        <a href="https://ian.trainerhub.cc/blog" rel="noopener" target="_blank">
          {copy.blogLink}
          <span className="sr-only"> {copy.opensInNewTab}</span>
        </a>
      </p>
    </section>
  );
}
