'use client';

import Image from 'next/image';
import { flushSync } from 'react-dom';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { GameOverlay } from './train/GameOverlay';
import { AssignedPracticePlan } from './AssignedPracticePlan';
import { BuildHubGameCatalog, type HubGame } from './gameCatalog';
import { BuildActivityHref } from './activityLinks';
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
import { useBottomSheet } from '@rehab-trainer/ui/hooks/useBottomSheet';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';
import {
  FetchPublishedGames,
  type PublishedGame,
} from './publishedGames';
import { BuildTrainingThemeStyle } from './trainingThemeStyle';
import { BuildLobbyFilterChips, BuildLobbyPageNumbers, FilterLobbyGames, PaginateLobbyGames, type LobbyFilterChip } from './lobbyResults.js';
import { AnimateVisibleGameCards, CancelHubGameTransition, TransitionGameSurface } from './hubMotion';
import { StartHubTour } from './tour/hubTour';
import featureIndex from '../recommendation/generated/featureIndex.json';
import { OrderLobbyGames } from './lobbyRecommendations.js';
import { useLobbyActivityHistory } from './useLobbyActivityHistory';

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
  const [page, setPage] = useState(1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultTitleRef = useRef<HTMLHeadingElement>(null);
  const activeFiltersRef = useRef<HTMLDivElement>(null);
  const pendingFilterFocus = useRef<number | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const dismissFilters = useCallback(() => setIsMobileFilterOpen(false), []);
  const { dialogRef, isMobile, isExpanded, toggleDetent } = useBottomSheet(isMobileFilterOpen, dismissFilters);
  const [activeGame, setActiveGame] = useState<HubGame | null>(null);
  const [publishedGames, setPublishedGames] = useState<PublishedGame[]>([]);
  const [publishedGamesStatus, setPublishedGamesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [catalogRefresh, setCatalogRefresh] = useState(0);
  const catalogNoticeRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const previousGameIds = useRef<ReadonlySet<string>>(new Set());
  const launchCardRef = useRef<HTMLElement | null>(null);
  const handleCloseOverlay = useCallback(() => {
    TransitionGameSurface(document.querySelector('.hub-game-transition-surface'), () => {
      flushSync(() => setActiveGame(null));
      if (launchCardRef.current?.isConnected) return launchCardRef.current;
      resultTitleRef.current?.focus({ preventScroll: true });
      return null;
    });
  }, []);
  const LaunchGame = (game: HubGame, trigger: HTMLButtonElement) => {
    const card = trigger.closest<HTMLElement>('[data-runtime-id]') ?? trigger;
    launchCardRef.current = card;
    TransitionGameSurface(card, () => {
      flushSync(() => setActiveGame(game));
      return document.querySelector('.hub-game-transition-surface');
    });
  };
  const { language, locale, t } = useHubLanguage();
  const hubCopy = GetHubUiCopy(language);
  const copy = hubCopy.lobby;
  const platformCopy = language === 'en'
    ? {
        author: 'Author',
        install: 'Install game',
        summaryFallback: 'A home-practice activity.',
        version: 'Version',
      }
    : {
        author: '作者',
        install: '安裝遊戲',
        summaryFallback: '居家練習活動。',
        version: '版本',
      };
  const games = useMemo(() => BuildHubGameCatalog(trainingCatalog, publishedGames, locale), [publishedGames, locale]);
  const gamesById = useMemo(() => new Map(games.map(game => [game.id, game])), [games]);
  const knownIds = useMemo(() => new Set(gamesById.keys()), [gamesById]);
  const playCounts = useLobbyActivityHistory(knownIds);
  const { games: orderedGames, cues } = useMemo(
    () => OrderLobbyGames(games, playCounts, featureIndex.similarityScores),
    [games, playCounts],
  );
  const searchGames = useMemo(() => FilterLobbyGames(orderedGames, query, locale), [orderedGames, query, locale]);

  const purposeCounts = useMemo(() => new Map(
    trainingPurposes.map((purpose) => [
      purpose.id,
      searchGames.filter((game) => game.purpose === purpose.id).length,
    ]),
  ), [searchGames]);

  const categoryCounts = useMemo(() => new Map(
    trainerCategoryTags.map((category) => {
      const subs = categorySubcategories[category.id] ?? [];
      const count = subs.reduce((sum, subId) => sum + (purposeCounts.get(subId) ?? 0), 0);
      return [category.id, count];
    }),
  ), [purposeCounts]);

  const toggleCategory = (categoryId: TrainerCategoryId) => {
    const subs = (categorySubcategories[categoryId] ?? [])
      .filter(subId => (purposeCounts.get(subId) ?? 0) > 0 || selectedPurposes.includes(subId));
    const allSelected = subs.length > 0 && subs.every((subId) => selectedPurposes.includes(subId));
    if (allSelected) {
      setSelectedPurposes((current) => current.filter((id) => !subs.includes(id)));
    } else {
      setSelectedPurposes((current) => [...new Set([...current, ...subs])]);
    }
  };

  const visibleGames = useMemo(() => searchGames.filter((game) => (
    selectedPurposes.length === 0 || (game.purpose !== null && selectedPurposes.includes(game.purpose))
  )), [searchGames, selectedPurposes]);

  const activeFilters = useMemo(() => BuildLobbyFilterChips(selectedPurposes, query, categorySubcategories), [selectedPurposes, query]);
  const pagination = PaginateLobbyGames(visibleGames, page);
  const pageNumbers = BuildLobbyPageNumbers(pagination.page, pagination.totalPages);
  const visibleGameKey = pagination.items.map(game => game.id).join('|');

  useEffect(() => {
    const stop = AnimateVisibleGameCards(gridRef.current, previousGameIds.current);
    previousGameIds.current = new Set(pagination.items.map(game => game.id));
    return stop;
  }, [visibleGameKey]);

  useEffect(() => CancelHubGameTransition, []);

  useEffect(() => {
    setPage(1);
  }, [query, selectedPurposes]);

  useEffect(() => {
    setPage((current) => Math.min(current, pagination.totalPages));
  }, [pagination.totalPages]);

  useEffect(() => {
    const index = pendingFilterFocus.current;
    if (index === null) return;
    pendingFilterFocus.current = null;
    const buttons = activeFiltersRef.current?.querySelectorAll<HTMLButtonElement>('button');
    (buttons?.[index] ?? resultTitleRef.current)?.focus();
  }, [activeFilters]);

  useEffect(() => {
    const controller = new AbortController();
    setPublishedGamesStatus('loading');
    void FetchPublishedGames(controller.signal)
      .then((games) => {
        if (controller.signal.aborted) return;
        setPublishedGames(games);
        setPublishedGamesStatus('ready');
        if (catalogRefresh > 0) resultTitleRef.current?.focus({ preventScroll: true });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPublishedGamesStatus('error');
      });
    return () => controller.abort();
  }, [catalogRefresh]);

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
    if (activeFiltersRef.current?.contains(document.activeElement)) pendingFilterFocus.current = 0;
    setQuery('');
    setSelectedPurposes([]);
  };

  const removeFilter = (chip: LobbyFilterChip, index: number) => {
    pendingFilterFocus.current = index;
    if (chip.kind === 'search') setQuery('');
    else setSelectedPurposes((current) => current.filter((id) => !chip.purposeIds.includes(id)));
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    resultTitleRef.current?.focus({ preventScroll: true });
    resultTitleRef.current?.scrollIntoView({ block: 'start' });
  };

  const totalVisibleCount = visibleGames.length;

  return (
    <>
    {activeGame && (
      <GameOverlay game={activeGame} onClose={handleCloseOverlay} />
    )}
    <main className="lobby-page" id="main-content">
      <section className="lobby-heading" aria-labelledby="lobby-title">
        <div className="lobby-welcome">
          <h1 id="lobby-title"><span className="sr-only">{copy.kicker} </span>{copy.title}</h1>
          <p className="lobby-description">{copy.description}</p>
          <div className="lobby-first-visit">
            <span>{copy.firstVisit}</span>
            <button className="lobby-tour-button" onClick={() => StartHubTour(language, { force: true })} type="button">
              <span className="material-symbols-outlined" aria-hidden="true">explore</span>
              <span className="lobby-link-label">{copy.startTour}</span>
            </button>
            <a className="lobby-guide-link" href="#lobby-guide">
              <span className="material-symbols-outlined" aria-hidden="true">menu_book</span>
              <span className="lobby-link-label">{copy.readGuide}</span>
            </a>
            <a className="lobby-guide-link" href="/activity-map/">
              <span className="lobby-link-label">{hubCopy.activityMap.title}</span>
            </a>
          </div>
        </div>

        <aside className="lobby-start-note" aria-label={copy.practiceNote}>
          <span className="material-symbols-outlined" aria-hidden="true">self_improvement</span>
          <div>
            <strong>{copy.practiceNote}</strong>
            <p>{copy.intro}</p>
          </div>
        </aside>

        <div className="lobby-search-row">
          <div className="module-search">
            <label htmlFor="module-search-input" className="sr-only">{copy.searchLabel}</label>
            <span className="material-symbols-outlined" aria-hidden="true">search</span>
            <input
              id="module-search-input"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.searchPlaceholder}
              ref={searchInputRef}
              type="search"
              value={query}
            />
            {query && (
              <button
                aria-label={copy.clearSearch}
                className="module-search-clear"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                type="button"
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            )}
          </div>
          <p className="lobby-search-hint">{copy.searchHint}</p>
        </div>
      </section>
      <AssignedPracticePlan />
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

        <dialog
          aria-labelledby="filter-title"
          className="filter-panel"
          data-bottom-sheet
          id="filter-panel"
          open
          ref={dialogRef}
          role={isMobile ? 'dialog' : 'complementary'}
        >
          <button
            aria-expanded={isExpanded}
            aria-label={copy.resizeFilters}
            className="filter-sheet-handle"
            data-bottom-sheet-grabber
            onClick={toggleDetent}
            type="button"
          />

          <div className="filter-header" data-bottom-sheet-drag-region>
            <h2 id="filter-title">{copy.purposeLegend}</h2>
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

          <div className="filter-category-groups" data-bottom-sheet-content>
            {trainerCategoryTags.map((category) => {
              const subs = categorySubcategories[category.id] ?? [];
              const availableSubs = subs.filter(subId => (purposeCounts.get(subId) ?? 0) > 0 || selectedPurposes.includes(subId));
              const isCategoryChecked = availableSubs.length > 0 && availableSubs.every((subId) => selectedPurposes.includes(subId));
              const isCategoryIndeterminate = !isCategoryChecked && subs.some((subId) => selectedPurposes.includes(subId));
              const categoryTotalCount = categoryCounts.get(category.id) ?? 0;
              const isCategoryDisabled = categoryTotalCount === 0 && !subs.some(subId => selectedPurposes.includes(subId));
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
                        disabled={isCategoryDisabled}
                        onChange={() => toggleCategory(category.id)}
                        ref={(el) => {
                          if (el) el.indeterminate = isCategoryIndeterminate;
                        }}
                        type="checkbox"
                      />
                      <span className="filter-category-name">{categoryLabel}</span>
                      <small>{isCategoryDisabled ? copy.noneYet : categoryTotalCount}</small>
                    </label>
                  </legend>

                  <div className="filter-subcategory-list">
                    {subs.map((subId) => {
                      const theme = trainingThemes[subId];
                      const subLabel = language === 'en' ? theme.label.en : theme.label['zh-TW'];
                      const subCount = purposeCounts.get(subId) ?? 0;
                      const isSelected = selectedPurposes.includes(subId);
                      const isDisabled = subCount === 0 && !isSelected;
                      return (
                        <label
                          className="filter-option filter-subcategory-option"
                          key={subId}
                          style={BuildTrainingThemeStyle(theme)}
                        >
                          <input
                            checked={isSelected}
                            disabled={isDisabled}
                            onChange={() => togglePurpose(subId)}
                            type="checkbox"
                          />
                          <span>{subLabel}</span>
                          <small>{isDisabled ? copy.noneYet : subCount}</small>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <div className="filter-sheet-footer" data-bottom-sheet-footer>
            <button
              className="filter-sheet-apply-btn"
              onClick={() => setIsMobileFilterOpen(false)}
              type="button"
            >
              {copy.viewResults.replace('{count}', String(totalVisibleCount))}
            </button>
          </div>
        </dialog>

        <section className="module-results" aria-labelledby="result-title">
          <div className="result-header">
            <h2 id="result-title" ref={resultTitleRef} tabIndex={-1}>{copy.allModules}</h2>
            <p aria-live="polite">
              {t('lobby.moduleCount', { count: visibleGames.length })}
              {visibleGames.length > 0 && t('lobby.moduleRange', { start: pagination.start, end: pagination.end })}
            </p>
          </div>

          {activeFilters.length > 0 && (
            <div className="lobby-active-filters" ref={activeFiltersRef} role="group" aria-label={copy.activeFilters}>
              {activeFilters.map((chip, index) => {
                const theme = chip.kind === 'category' ? GetTrainerCategoryTheme(chip.id)
                  : chip.kind === 'purpose' ? trainingThemes[chip.id] : null;
                const label = chip.kind === 'search' ? t('lobby.searchFilter', { query: chip.query })
                  : chip.kind === 'category' ? trainerCategoryTags.find((category) => category.id === chip.id)!.label[locale]
                    : trainingThemes[chip.id].label[locale];
                return (
                  <button
                    aria-label={t('lobby.removeFilter', { filter: label })}
                    className="lobby-filter-chip"
                    key={chip.key}
                    onClick={() => removeFilter(chip, index)}
                    style={theme ? BuildTrainingThemeStyle(theme) : undefined}
                    type="button"
                  >
                    <span>{label}</span>
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                );
              })}
              <button className="lobby-clear-filters" onClick={clearFilters} type="button">{copy.clearAllFilters}</button>
            </div>
          )}

          {cues.size > 0 && <p className="lobby-order-note">{copy.personalOrder.note}</p>}
          <div className="module-grid" ref={gridRef}>
            {pagination.items.map((game) => {
              const cue = cues.get(game.id);
              const similarTo = cue?.tier === 'similar' ? gamesById.get(cue.reasonGameId) : null;
              const orderCue = cue?.tier === 'played' ? copy.personalOrder.played
                : similarTo ? t('lobby.personalOrder.similar', { activity: similarTo.title }) : null;
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
                        alt={game.title + (language === 'en' ? ' activity screen' : ' 活動畫面')}
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
                        <TrainingThemeIcon decorative label={game.subcategoryLabel} theme={game.theme} />
                      </span>
                    </div>
                    <h3>{game.title}</h3>
                    {orderCue && <p className="module-card-order-cue">{orderCue}</p>}
                    <p>{game.summary || platformCopy.summaryFallback}</p>
                    {game.launch.contract === 'package-v1' && <dl className="community-game-details">
                      <div><dt>{platformCopy.author}</dt><dd>{game.author}</dd></div>
                      {game.version && <div><dt>{platformCopy.version}</dt><dd>{game.version}</dd></div>}
                    </dl>}
                    <p className="module-card-requirement">
                      <span className="material-symbols-outlined" aria-hidden="true">{game.requirement === 'none' ? 'check_circle' : 'info'}</span>
                      {copy.requirements[game.requirement]}
                    </p>
                    <div className="module-card-footer official-game-actions">
                      <button
                        aria-label={copy.start + ': ' + game.title}
                        onClick={event => LaunchGame(game, event.currentTarget)}
                        onFocus={preload}
                        onPointerDown={preload}
                        type="button"
                      >
                        {copy.start}
                        <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                      </button>
                      <a aria-label={platformCopy.install + ': ' + game.title} href={game.installUrl} rel="noopener noreferrer" target="_blank">
                        <span className="lobby-link-label">{platformCopy.install}</span>
                        <span className="material-symbols-outlined" aria-hidden="true">download</span>
                      </a>
                      {game.launch.contract === 'catalog-v1' && (
                        <a href={BuildActivityHref(game.id)} aria-label={hubCopy.activities.details + ': ' + game.title}>
                          <span className="lobby-link-label">{hubCopy.activities.details}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {publishedGamesStatus !== 'ready' && (
            <div className="catalog-load-notice" data-state={publishedGamesStatus} ref={catalogNoticeRef} role="status" tabIndex={-1}>
              {publishedGamesStatus === 'loading' ? <p>{copy.catalogLoading}</p> : <>
                <span className="material-symbols-outlined" aria-hidden="true">warning</span>
                <p>{copy.catalogUnavailable}</p>
                <button onClick={() => {
                  catalogNoticeRef.current?.focus();
                  setPublishedGamesStatus('loading');
                  setCatalogRefresh(value => value + 1);
                }} type="button">
                  <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                  {copy.catalogRetry}
                </button>
              </>}
            </div>
          )}

          {pagination.totalPages > 1 && (
            <nav className="lobby-pagination" aria-label={copy.paginationLabel}>
              <button disabled={pagination.page === 1} onClick={() => changePage(pagination.page - 1)} type="button">
                {copy.previousPage}
              </button>
              <div className="lobby-page-numbers">
                {pageNumbers.map((number, index) => number === 'ellipsis' ? (
                  <span aria-hidden="true" key={`gap-${index}`}>...</span>
                ) : (
                  <button
                    aria-current={number === pagination.page ? 'page' : undefined}
                    aria-label={t('lobby.pageNumber', { page: number })}
                    key={number}
                    onClick={() => changePage(number)}
                    type="button"
                  >
                    {number}
                  </button>
                ))}
              </div>
              <button disabled={pagination.page === pagination.totalPages} onClick={() => changePage(pagination.page + 1)} type="button">
                {copy.nextPage}
              </button>
            </nav>
          )}

          {visibleGames.length === 0 && (
            <div className="empty-results">
              <span className="material-symbols-outlined" aria-hidden="true">search_off</span>
              <h3>{copy.noResultsTitle}</h3>
              <button onClick={clearFilters} type="button">{copy.noResultsAction}</button>
            </div>
          )}
        </section>
      </div>

      <section className="lobby-guide" id="lobby-guide" aria-labelledby="lobby-guide-title">
        <header>
          <h2 id="lobby-guide-title">{copy.guide.title}</h2>
          <p>{copy.guide.definition}</p>
        </header>
        <ol className="lobby-guide-steps">
          <li>
            <h3>{copy.guide.chooseTitle}</h3>
            <p>{copy.guide.chooseBody}</p>
          </li>
          <li>
            <h3>{copy.guide.prepareTitle}</h3>
            <p>{copy.guide.prepareBody}</p>
          </li>
        </ol>
        <aside className="lobby-guide-note" aria-labelledby="lobby-guide-limits-title">
          <h3 id="lobby-guide-limits-title">{copy.guide.limitsTitle}</h3>
          <p>{copy.guide.limitsBody}</p>
        </aside>
        <div className="lobby-guide-details">
          <details>
            <summary><h3>{copy.guide.recordsTitle}</h3></summary>
            <p>{copy.guide.recordsBody}</p>
          </details>
          <details>
            <summary><h3>{copy.guide.privacyTitle}</h3></summary>
            <p>{copy.guide.privacyBody}</p>
          </details>
          <details>
            <summary><h3>{copy.guide.reviewTitle}</h3></summary>
            <p>{copy.guide.reviewBody}</p>
          </details>
        </div>
        <nav aria-label={copy.guide.kicker} className="lobby-guide-links">
          <a href="/about/">{copy.guide.aboutLink}</a>
          <a href="/qa/">{copy.guide.educationLink}</a>
          <a href="/privacy/">{copy.guide.privacyLink}</a>
          <a href="/activities/">{hubCopy.activities.title}</a>
          <a href="/activity-map/">{hubCopy.activityMap.title}</a>
        </nav>
      </section>
    </main>
    </>
  );
}
