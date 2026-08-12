'use client';

import { GetHubUiCopy } from '../i18n';
import { useHubLanguage } from '../i18n/HubLanguage';
import { siteUrls } from '../siteUrls';
import { EducationArticles } from './EducationArticles';

const trainerLinks = [
  {
    id: 'motor',
    name: 'MotorTrainer',
  },
  {
    id: 'vision',
    name: 'VisionTrainer',
  },
  {
    id: 'brain',
    name: 'BrainTrainer',
  },
  {
    id: 'mouth',
    name: 'MouthTrainer',
  },
] as const;

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

      <section className="trainer-links-section" aria-labelledby="trainer-links-title">
        <div className="section-title-row">
          <div>
            <p className="page-kicker">{copy.servicesKicker}</p>
            <h2 id="trainer-links-title">{copy.servicesTitle}</h2>
          </div>
        </div>
        <div className="trainer-link-grid">
          {trainerLinks.map((trainer) => (
            <a
              className={`trainer-link-card trainer-${trainer.id}`}
              href={siteUrls[trainer.id]}
              key={trainer.id}
            >
              <span className="material-symbols-outlined" aria-hidden="true">open_in_new</span>
              <h3>{trainer.name}</h3>
              <p>{copy.trainerDescriptions[trainer.id]}</p>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
