'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrainingOverlay } from './train/TrainingOverlay';
import {
  BuildTrainingModuleHref,
  BuildTrainingModuleImageSrc,
  GetTrainingModuleCopy,
  GetTrainingPurpose,
  trainingCatalog,
  trainingPurposes,
  type TrainerCatalogId,
  type TrainingCatalogModule,
  type TrainingPurposeId,
} from '@rehab-trainer/hub-modules/catalog';
import { CardImagePlaceholder } from '@rehab-trainer/ui/components/CardImagePlaceholder';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';

const trainerVisuals: Record<TrainerCatalogId, {
  name: string;
  logo: string;
  logoAlt: string;
}> = {
  motor: {
    name: 'MotorTrainer',
    logo: '/assets/motor-logo.svg',
    logoAlt: 'MotorTrainer',
  },
  vision: {
    name: 'VisionTrainer',
    logo: '/assets/vision-logo.svg',
    logoAlt: 'VisionTrainer',
  },
  brain: {
    name: 'BrainTrainer',
    logo: '/assets/brain-logo.svg',
    logoAlt: 'BrainTrainer',
  },
  mouth: {
    name: 'MouthTrainer',
    logo: '/assets/mouth-logo.svg',
    logoAlt: 'MouthTrainer',
  },
};

const prefetchedTrainingUrls = new Set<string>();

function PreloadTrainingModule(module: TrainingCatalogModule) {
  const href = BuildTrainingModuleHref(module);
  if (prefetchedTrainingUrls.has(href)) return;
  prefetchedTrainingUrls.add(href);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = 'document';
  link.href = href;
  document.head.append(link);
}

export function TrainingLobby() {
  const [query, setQuery] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<TrainingPurposeId[]>([]);
  const [activeModule, setActiveModule] = useState<TrainingCatalogModule | null>(null);
  const handleCloseOverlay = useCallback(() => setActiveModule(null), []);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).lobby;
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);

  const purposeCounts = useMemo(() => new Map(
    trainingPurposes.map((purpose) => [
      purpose.id,
      trainingCatalog.filter((module) => module.purpose === purpose.id).length,
    ]),
  ), []);

  const visibleModules = useMemo(() => trainingCatalog.filter((module) => {
    const title = GetTrainingModuleCopy(module, locale).title.toLocaleLowerCase(locale);
    const matchesSearch = !normalizedQuery || title.includes(normalizedQuery);
    const matchesPurpose = selectedPurposes.length === 0
      || selectedPurposes.includes(module.purpose);
    return matchesSearch && matchesPurpose;
  }), [locale, normalizedQuery, selectedPurposes]);

  useEffect(() => {
    const origins = new Set(trainingCatalog.map((module) => (
      new URL(BuildTrainingModuleHref(module)).origin
    )));
    const links = [...origins].flatMap((origin) => {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = origin;
      preconnect.crossOrigin = 'anonymous';
      const dnsPrefetch = document.createElement('link');
      dnsPrefetch.rel = 'dns-prefetch';
      dnsPrefetch.href = origin;
      document.head.append(preconnect, dnsPrefetch);
      return [preconnect, dnsPrefetch];
    });

    return () => links.forEach((link) => link.remove());
  }, []);

  const togglePurpose = (purposeId: TrainingPurposeId) => {
    setSelectedPurposes((current) => (
      current.includes(purposeId)
        ? current.filter((id) => id !== purposeId)
        : [...current, purposeId]
    ));
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedPurposes([]);
  };

  return (
    <>
    {activeModule && (
      <TrainingOverlay module={activeModule} onClose={handleCloseOverlay} />
    )}
    <main className="lobby-page" id="main-content">
      <section className="lobby-heading" aria-labelledby="lobby-title">
        <div>
          <p className="page-kicker">Rehab Trainer Hub</p>
          <h1 id="lobby-title">{copy.title}</h1>
          <p>{copy.intro}</p>
        </div>

        <label className="module-search">
          <span className="material-symbols-outlined" aria-hidden="true">search</span>
          <span className="sr-only">{copy.searchLabel}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
            type="search"
            value={query}
          />
        </label>
      </section>

      <div className="lobby-layout">
        <aside className="filter-panel" aria-labelledby="filter-title">
          <div className="filter-heading">
            <h2 id="filter-title">{copy.filters}</h2>
            {(selectedPurposes.length > 0 || query) && (
              <button onClick={clearFilters} type="button">{copy.clear}</button>
            )}
          </div>

          <fieldset>
            <legend className="sr-only">{copy.purposeLegend}</legend>
            {trainingPurposes.map((purpose) => (
              <label className="filter-option" key={purpose.id}>
                <input
                  checked={selectedPurposes.includes(purpose.id)}
                  onChange={() => togglePurpose(purpose.id)}
                  type="checkbox"
                />
                <span>{language === 'en' ? purpose.labelEn : purpose.label}</span>
                <small>{purposeCounts.get(purpose.id) ?? 0}</small>
              </label>
            ))}
          </fieldset>
        </aside>

        <section className="module-results" aria-labelledby="result-title">
          <div className="result-heading">
            <h2 id="result-title">{copy.allModules}</h2>
            <p aria-live="polite">{t('lobby.moduleCount', { count: visibleModules.length })}</p>
          </div>

          {visibleModules.length > 0 ? (
            <div className="module-grid">
              {visibleModules.map((module) => {
                const moduleCopy = GetTrainingModuleCopy(module, locale);
                const purpose = GetTrainingPurpose(module.purpose);
                const trainer = trainerVisuals[module.trainer];

                return (
                  <article
                    aria-label={`${copy.start}: ${moduleCopy.title}`}
                    className={`module-card trainer-${module.trainer}`}
                    key={module.catalogId}
                    onClick={() => setActiveModule(module)}
                    onFocus={() => PreloadTrainingModule(module)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setActiveModule(module);
                    }}
                    onPointerDown={() => PreloadTrainingModule(module)}
                    onPointerEnter={() => PreloadTrainingModule(module)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="module-card-visual" aria-label={moduleCopy.title} role="img">
                      <CardImagePlaceholder src={BuildTrainingModuleImageSrc(module)} />
                    </div>
                    <div className="module-card-content">
                      <div className="module-card-meta">
                        <span>{language === 'en' ? purpose.labelEn : purpose.label}</span>
                        <Image
                          src={trainer.logo}
                          alt={trainer.logoAlt}
                          width={52}
                          height={36}
                        />
                      </div>
                      <h3>{moduleCopy.title}</h3>
                      <p>{moduleCopy.description}</p>
                      <div className="module-card-footer">
                        <span>{trainer.name}</span>
                        <span className="module-card-action" aria-hidden="true">
                          {copy.start}
                          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-results">
              <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
              <h3>{copy.noResultsTitle}</h3>
              <button onClick={clearFilters} type="button">{copy.noResultsAction}</button>
            </div>
          )}
        </section>
      </div>
    </main>
    </>
  );
}
