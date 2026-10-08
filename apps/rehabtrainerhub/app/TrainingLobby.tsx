'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { GameOverlay } from './train/GameOverlay';
import { BuildHubGameCatalog, type HubGame } from './gameCatalog';
import {
  BuildTrainingModuleHref,
  GetTrainerCategoryTheme,
  categorySubcategories,
  trainerCategoryTags,
  trainingCatalog,
  trainingPurposes,
  trainingThemes,
  type TrainerCategoryId,
  type TrainingCatalogModule,
  type TrainingPurposeId,
  type TrainingVisualTheme,
} from '@rehab-trainer/hub-modules/catalog';
import { CardImagePlaceholder } from '@rehab-trainer/ui/components/CardImagePlaceholder';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';
import {
  FetchPublishedGames,
  type PublishedGame,
} from './publishedGames';
import { BuildTrainingThemeStyle } from './trainingThemeStyle';

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

function TrainingThemeIcon({
  decorative = false,
  label,
  theme,
}: {
  decorative?: boolean;
  label: string;
  theme: TrainingVisualTheme;
}) {
  if (theme.icon.type === 'svg') {
    return (
      <Image
        className="module-card-theme-image"
        src={theme.icon.value}
        alt={decorative ? '' : (theme.icon.alt ?? label)}
        width={52}
        height={36}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="material-symbols-outlined module-card-theme-icon"
    >
      {theme.icon.value}
    </span>
  );
}

function TrainingThemeBadge({
  language,
  theme,
}: {
  language: 'en' | 'zh';
  theme: TrainingVisualTheme;
}) {
  if (!theme.badge) return null;
  return (
    <span className="module-theme-badge">
      {language === 'en' ? theme.badge.text.en : theme.badge.text['zh-TW']}
    </span>
  );
}

export function TrainingLobby() {
  const [query, setQuery] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<TrainingPurposeId[]>([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [activeGame, setActiveGame] = useState<HubGame | null>(null);
  const [publishedGames, setPublishedGames] = useState<PublishedGame[]>([]);
  const [publishedGamesError, setPublishedGamesError] = useState(false);
  const handleCloseOverlay = useCallback(() => setActiveGame(null), []);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).lobby;
  const platformCopy = language === 'en'
    ? {
        catalogUnavailable: 'Some games could not be loaded. Available games can still be played.',
        author: 'Author',
        install: 'Install game',
        summaryFallback: 'A home-practice activity.',
        version: 'Version',
      }
    : {
        catalogUnavailable: '部分遊戲目前無法載入，已顯示的遊戲仍可開始。',
        author: '作者',
        install: '安裝遊戲',
        summaryFallback: '居家練習活動。',
        version: '版本',
      };
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const games = useMemo(() => BuildHubGameCatalog(trainingCatalog, publishedGames, locale), [publishedGames, locale]);

  const purposeCounts = useMemo(() => new Map(
    trainingPurposes.map((purpose) => [
      purpose.id,
      games.filter((game) => game.purpose === purpose.id).length,
    ]),
  ), [games]);

  const categoryCounts = useMemo(() => new Map(
    trainerCategoryTags.map((category) => {
      const subs = categorySubcategories[category.id] ?? [];
      const count = subs.reduce((sum, subId) => sum + (purposeCounts.get(subId) ?? 0), 0);
      return [category.id, count];
    }),
  ), [purposeCounts]);

  const toggleCategory = (categoryId: TrainerCategoryId) => {
    const subs = categorySubcategories[categoryId] ?? [];
    const allSelected = subs.length > 0 && subs.every((subId) => selectedPurposes.includes(subId));
    if (allSelected) {
      setSelectedPurposes((current) => current.filter((id) => !subs.includes(id)));
    } else {
      setSelectedPurposes((current) => [...new Set([...current, ...subs])]);
    }
  };

  const visibleGames = useMemo(() => games.filter((game) => {
    const searchable = (game.title + ' ' + game.summary + ' ' + game.author).toLocaleLowerCase(locale);
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (selectedPurposes.length === 0 || (game.purpose !== null && selectedPurposes.includes(game.purpose)));
  }), [games, locale, normalizedQuery, selectedPurposes]);

  useEffect(() => {
    const controller = new AbortController();
    setPublishedGamesError(false);
    void FetchPublishedGames(controller.signal)
      .then(setPublishedGames)
      .catch(() => {
        if (!controller.signal.aborted) setPublishedGamesError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const origins = new Set(trainingCatalog.map((module) => (
      new URL(BuildTrainingModuleHref(module), window.location.origin).origin
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

  useEffect(() => {
    const origins = new Set(publishedGames.map((game) => new URL(game.release.launchUrl).origin));
    const links = [...origins].map((origin) => {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = origin;
      preconnect.crossOrigin = 'anonymous';
      document.head.append(preconnect);
      return preconnect;
    });
    return () => links.forEach((link) => link.remove());
  }, [publishedGames]);

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

  const totalVisibleCount = visibleGames.length;

  useEffect(() => {
    if (!isMobileFilterOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileFilterOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileFilterOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = isMobileFilterOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileFilterOpen]);

  return (
    <>
    {activeGame && (
      <GameOverlay game={activeGame} onClose={handleCloseOverlay} />
    )}
    <main className="lobby-page" id="main-content">
      <section className="lobby-heading" aria-labelledby="lobby-title">
        <div>
          <p className="page-kicker">{copy.kicker}</p>
          <h1 id="lobby-title">
            <span className="sr-only">{copy.kicker} </span>
            {copy.title}
          </h1>
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
        <div className="mobile-filter-bar">
          <button
            aria-controls="filter-panel"
            aria-expanded={isMobileFilterOpen}
            className="filter-mobile-trigger"
            onClick={() => setIsMobileFilterOpen(true)}
            type="button"
          >
            <span className="material-symbols-outlined" aria-hidden="true">tune</span>
            <span>{copy.filters}</span>
            {selectedPurposes.length > 0 && (
              <span className="filter-active-badge">{selectedPurposes.length}</span>
            )}
          </button>
          {(selectedPurposes.length > 0 || query) && (
            <button
              className="filter-mobile-clear-btn"
              onClick={clearFilters}
              type="button"
            >
              {copy.clear}
            </button>
          )}
        </div>

        <div
          aria-hidden="true"
          className={`filter-sheet-backdrop${isMobileFilterOpen ? ' is-open' : ''}`}
          onClick={() => setIsMobileFilterOpen(false)}
        />

        <aside
          aria-labelledby="filter-title"
          className={`filter-panel${isMobileFilterOpen ? ' is-open' : ''}`}
          id="filter-panel"
        >
          <div aria-hidden="true" className="filter-sheet-handle" />

          <div className="filter-header">
            <h2 id="filter-title">{copy.filters}</h2>
            <div className="filter-header-actions">
              {(selectedPurposes.length > 0 || query) && (
                <button onClick={clearFilters} type="button">{copy.clear}</button>
              )}
              <button
                aria-label={copy.closeFilters}
                className="filter-sheet-close"
                onClick={() => setIsMobileFilterOpen(false)}
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </div>
          </div>

          <div className="filter-category-groups">
            {trainerCategoryTags.map((category) => {
              const subs = categorySubcategories[category.id] ?? [];
              const isCategoryChecked = subs.length > 0 && subs.every((subId) => selectedPurposes.includes(subId));
              const isCategoryIndeterminate = !isCategoryChecked && subs.some((subId) => selectedPurposes.includes(subId));
              const categoryTotalCount = categoryCounts.get(category.id) ?? 0;
              const categoryTheme = GetTrainerCategoryTheme(category.id);
              const categoryLabel = language === 'en' ? category.label.en : category.label['zh-TW'];

              return (
                <fieldset
                  className="filter-category-group"
                  data-category={category.id}
                  key={category.id}
                  style={BuildTrainingThemeStyle(categoryTheme)}
                >
                  <legend className="filter-category-legend">
                    <label className="filter-category-header">
                      <input
                        checked={isCategoryChecked}
                        onChange={() => toggleCategory(category.id)}
                        ref={(el) => {
                          if (el) el.indeterminate = isCategoryIndeterminate;
                        }}
                        type="checkbox"
                      />
                      <span className="filter-category-name">{categoryLabel}</span>
                      <small>{categoryTotalCount}</small>
                    </label>
                  </legend>

                  <div className="filter-subcategory-list">
                    {subs.map((subId) => {
                      const theme = trainingThemes[subId];
                      const subLabel = language === 'en' ? theme.label.en : theme.label['zh-TW'];
                      const subCount = purposeCounts.get(subId) ?? 0;
                      return (
                        <label
                          className="filter-option filter-subcategory-option"
                          key={subId}
                          style={BuildTrainingThemeStyle(theme)}
                        >
                          <input
                            checked={selectedPurposes.includes(subId)}
                            onChange={() => togglePurpose(subId)}
                            type="checkbox"
                          />
                          <span>{subLabel}</span>
                          <small>{subCount}</small>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="filter-sheet-footer">
            <button
              className="filter-sheet-apply-btn"
              onClick={() => setIsMobileFilterOpen(false)}
              type="button"
            >
              {copy.viewResults.replace('{count}', String(totalVisibleCount))}
            </button>
          </div>
        </aside>

        <section className="module-results" aria-labelledby="result-title">
          <div className="result-header">
            <h2 id="result-title">{copy.allModules}</h2>
            <p aria-live="polite">{t('lobby.moduleCount', { count: visibleGames.length })}</p>
          </div>

          {publishedGamesError && (
            <p className="catalog-load-notice" role="status">
              {platformCopy.catalogUnavailable}
            </p>
          )}

          <div className="module-grid">
            {visibleGames.map((game) => {
              const preload = () => {
                if (game.launch.contract === 'catalog-v1') PreloadTrainingModule(game.launch.module);
              };
              return (
                <article
                  aria-label={copy.start + ': ' + game.title}
                  className="module-card official-game-card"
                  data-runtime-id={game.id}
                  key={game.id}
                  onPointerEnter={preload}
                  style={BuildTrainingThemeStyle(game.theme)}
                >
                  <div className="module-card-visual">
                    {game.imageSrc ? (
                      <CardImagePlaceholder
                        alt={game.title + (language === 'en' ? ' activity preview: ' : '活動畫面：') + game.summary}
                        height={360} loading="lazy" src={game.imageSrc} width={640}
                      />
                    ) : (
                      <div className="community-game-visual" aria-hidden="true">
                        <TrainingThemeIcon decorative label={game.subcategoryLabel} theme={game.theme} />
                      </div>
                    )}
                  </div>
                  <div className="module-card-content">
                    <div className="module-card-meta">
                      <div className="module-card-labels">
                        {game.categoryLabel && <span className="module-category-tag">{game.categoryLabel}</span>}
                        <span className="module-subcategory-tag">{game.subcategoryLabel}</span>
                      </div>
                      <span className="module-card-theme-adornments">
                        <TrainingThemeBadge language={language} theme={game.theme} />
                        <TrainingThemeIcon label={game.subcategoryLabel} theme={game.theme} />
                      </span>
                    </div>
                    <h3>{game.title}</h3>
                    <p>{game.summary || platformCopy.summaryFallback}</p>
                    <dl className="community-game-details">
                      <div><dt>{platformCopy.author}</dt><dd>{game.author}</dd></div>
                      {game.version && <div><dt>{platformCopy.version}</dt><dd>{game.version}</dd></div>}
                    </dl>
                    <div className="module-card-footer official-game-actions">
                      <button
                        onClick={() => setActiveGame(game)}
                        onFocus={preload}
                        onPointerDown={preload}
                        type="button"
                      >
                        {copy.start}
                        <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                      </button>
                      <a href={game.installUrl} rel="noopener noreferrer" target="_blank">
                        {platformCopy.install}
                        <span className="material-symbols-outlined" aria-hidden="true">download</span>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {visibleGames.length === 0 && (
            <div className="empty-results">
              <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
              <h3>{copy.noResultsTitle}</h3>
              <button onClick={clearFilters} type="button">{copy.noResultsAction}</button>
            </div>
          )}
        </section>
      </div>

      <section className="lobby-guide" aria-labelledby="lobby-guide-title">
        <header>
          <p className="page-kicker">{copy.guide.kicker}</p>
          <h2 id="lobby-guide-title">{copy.guide.title}</h2>
          <p>{copy.guide.definition}</p>
          <p className="lobby-guide-updated">{copy.guide.updated}</p>
        </header>
        <div className="lobby-guide-sections">
          <section>
            <h3>{copy.guide.chooseTitle}</h3>
            <p>{copy.guide.chooseBody}</p>
          </section>
          <section>
            <h3>{copy.guide.prepareTitle}</h3>
            <p>{copy.guide.prepareBody}</p>
          </section>
          <section>
            <h3>{copy.guide.recordsTitle}</h3>
            <p>{copy.guide.recordsBody}</p>
          </section>
          <section>
            <h3>{copy.guide.privacyTitle}</h3>
            <p>{copy.guide.privacyBody}</p>
          </section>
          <section>
            <h3>{copy.guide.limitsTitle}</h3>
            <p>{copy.guide.limitsBody}</p>
          </section>
          <section>
            <h3>{copy.guide.reviewTitle}</h3>
            <p>{copy.guide.reviewBody}</p>
          </section>
        </div>
        <nav aria-label={copy.guide.kicker} className="lobby-guide-links">
          <a href="/about/">{copy.guide.aboutLink}</a>
          <a href="/qa/">{copy.guide.educationLink}</a>
          <a href="/privacy/">{copy.guide.privacyLink}</a>
        </nav>
      </section>
    </main>
    </>
  );
}
