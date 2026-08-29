'use client';

import Image from 'next/image';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { TrainingOverlay } from './train/TrainingOverlay';
import { PackageGameOverlay } from './train/PackageGameOverlay';
import {
  BuildTrainingGameOfflineManifestHref,
  BuildTrainingModuleImageSrc,
  GetTrainingModuleCopy,
  GetTrainingModuleTheme,
  GetTrainingThemeId,
  trainingCatalog,
  trainingPurposes,
  type TrainingCatalogModule,
  type TrainingPurposeId,
  type TrainingVisualTheme,
} from '@rehab-trainer/hub-modules/catalog';
import { CardImagePlaceholder } from '@rehab-trainer/ui/components/CardImagePlaceholder';
import { OfflinePackControl } from '@rehab-trainer/ui/components/OfflinePackControl';
import { GetHubUiCopy } from './i18n';
import { useHubLanguage } from './i18n/HubLanguage';
import {
  FetchPublishedGames,
  type PublishedGame,
} from './publishedGames';
import { BuildTrainingThemeStyle } from './trainingThemeStyle';

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

function FormatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function TrainingLobby() {
  const [query, setQuery] = useState('');
  const [selectedPurposes, setSelectedPurposes] = useState<TrainingPurposeId[]>([]);
  const [activeModule, setActiveModule] = useState<TrainingCatalogModule | null>(null);
  const [activePackageGame, setActivePackageGame] = useState<PublishedGame | null>(null);
  const [publishedGames, setPublishedGames] = useState<PublishedGame[]>([]);
  const [publishedGamesError, setPublishedGamesError] = useState(false);
  const handleCloseOverlay = useCallback(() => setActiveModule(null), []);
  const handleClosePackageOverlay = useCallback(() => setActivePackageGame(null), []);
  const { language, locale, t } = useHubLanguage();
  const copy = GetHubUiCopy(language).lobby;
  const platformCopy = language === 'en'
    ? {
        catalogUnavailable: 'Developer games are temporarily unavailable. Built-in games are still available.',
        developer: 'Developer',
        developerLibrary: 'Developer games',
        install: 'Install game',
        offlineCapacity: 'Not enough browser storage is available for this offline pack.',
        offlineChecking: 'Checking offline pack…',
        offlineDownload: 'Download offline pack',
        offlineError: 'The offline pack is unavailable. Please try again later.',
        offlineInstall: 'Installing offline pack…',
        offlineIntegrity: 'Installed data changed; choose update to repair it.',
        offlineProgress: (completed: number, total: number) => `Offline pack progress: ${completed}/${total}`,
        offlineQuota: (bytes: number) => `Browser quota ${FormatBytes(bytes)}`,
        offlineReady: 'Available offline',
        offlineRemove: 'Remove offline copy',
        offlineSize: (bytes: number) => `${FormatBytes(bytes)} offline`,
        offlineUpdate: 'Update offline pack',
        officialLibrary: 'Rehab Trainer Hub built-in games',
        play: 'Play on platform',
        reviewed: 'Reviewed release',
        summaryFallback: 'A home-practice activity provided by its developer.',
        version: 'Version',
      }
    : {
        catalogUnavailable: '開發者遊戲目前無法載入；內建遊戲仍可正常使用。',
        developer: '開發者',
        developerLibrary: '開發者遊戲',
        install: '安裝遊戲',
        offlineCapacity: '瀏覽器可用儲存空間不足，無法下載此離線包。',
        offlineChecking: '正在檢查離線包…',
        offlineDownload: '下載離線包',
        offlineError: '離線包目前無法取得，請稍後再試。',
        offlineInstall: '正在安裝離線包…',
        offlineIntegrity: '已安裝資料與目前版本不同，請選擇更新修復。',
        offlineProgress: (completed: number, total: number) => `離線包進度：${completed}/${total}`,
        offlineQuota: (bytes: number) => `瀏覽器配額 ${FormatBytes(bytes)}`,
        offlineReady: '已可離線使用',
        offlineRemove: '移除離線副本',
        offlineSize: (bytes: number) => `離線大小 ${FormatBytes(bytes)}`,
        offlineUpdate: '更新離線包',
        officialLibrary: '居家訓練網內建遊戲',
        play: '在平台遊玩',
        reviewed: '已審核版本',
        summaryFallback: '開發者提供的居家練習活動。',
        version: '版本',
      };
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);

  const purposeCounts = useMemo(() => new Map(
    trainingPurposes.map((purpose) => [
      purpose.id,
      trainingCatalog.filter((module) => module.purpose === purpose.id).length
        + publishedGames.filter((game) => GetTrainingThemeId(game.category) === purpose.id).length,
    ]),
  ), [publishedGames]);

  const visibleModules = useMemo(() => trainingCatalog.filter((module) => {
    const title = GetTrainingModuleCopy(module, locale).title.toLocaleLowerCase(locale);
    const matchesSearch = !normalizedQuery || title.includes(normalizedQuery);
    const matchesPurpose = selectedPurposes.length === 0
      || selectedPurposes.includes(module.purpose);
    return matchesSearch && matchesPurpose;
  }), [locale, normalizedQuery, selectedPurposes]);

  const visiblePublishedGames = useMemo(() => publishedGames.filter((game) => {
    const searchable = `${game.title} ${game.summary} ${game.developerName}`.toLocaleLowerCase(locale);
    const purpose = GetTrainingThemeId(game.category);
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (selectedPurposes.length === 0 || (purpose !== null && selectedPurposes.includes(purpose)));
  }), [locale, normalizedQuery, publishedGames, selectedPurposes]);

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

  return (
    <>
    {activeModule && (
      <TrainingOverlay module={activeModule} onClose={handleCloseOverlay} />
    )}
    {activePackageGame && (
      <PackageGameOverlay game={activePackageGame} onClose={handleClosePackageOverlay} />
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
                <span>{language === 'en' ? purpose.label.en : purpose.label['zh-TW']}</span>
                <small>{purposeCounts.get(purpose.id) ?? 0}</small>
              </label>
            ))}
          </fieldset>
        </aside>

        <section className="module-results" aria-labelledby="result-title">
          <div className="result-heading">
            <h2 id="result-title">{copy.allModules}</h2>
            <p aria-live="polite">{t('lobby.moduleCount', { count: visibleModules.length + visiblePublishedGames.length })}</p>
          </div>

          {publishedGamesError && (
            <p className="catalog-load-notice" role="status">
              {platformCopy.catalogUnavailable}
            </p>
          )}

          {visibleModules.length > 0 && (
            <div className="library-section-heading">
              <div>
                <p className="page-kicker">Official library</p>
                <h3>{platformCopy.officialLibrary}</h3>
              </div>
              <span>{visibleModules.length}</span>
            </div>
          )}

          {visibleModules.length > 0 && (
            <div className="module-grid">
              {visibleModules.map((module) => {
                const moduleCopy = GetTrainingModuleCopy(module, locale);
                const theme = GetTrainingModuleTheme(module);
                const themeLabel = language === 'en' ? theme.label.en : theme.label['zh-TW'];

                return (
                  <article
                    aria-label={`${copy.start}: ${moduleCopy.title}`}
                    className="module-card official-game-card"
                    key={module.catalogId}
                    style={BuildTrainingThemeStyle(theme)}
                  >
                    <div className="module-card-visual">
                      <CardImagePlaceholder
                        alt={language === 'en'
                          ? `${moduleCopy.title} activity preview: ${moduleCopy.description}`
                          : `${moduleCopy.title}活動畫面：${moduleCopy.description}`}
                        height={360}
                        loading="lazy"
                        src={BuildTrainingModuleImageSrc(module)}
                        width={640}
                      />
                    </div>
                    <div className="module-card-content">
                      <div className="module-card-meta">
                        <span>{themeLabel}</span>
                        <span className="module-card-theme-adornments">
                          <TrainingThemeBadge language={language} theme={theme} />
                          <TrainingThemeIcon label={themeLabel} theme={theme} />
                        </span>
                      </div>
                      <h3>{moduleCopy.title}</h3>
                      <p>{moduleCopy.description}</p>
                      <div className="module-card-footer official-game-actions">
                        <button
                          onClick={() => setActiveModule(module)}
                          type="button"
                        >
                          {copy.start}
                          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                        </button>
                        <OfflinePackControl
                          expectedModuleId={module.catalogId}
                          expectedPackId={`official-game:${module.runtimeId}`}
                          labels={{
                            capacity: platformCopy.offlineCapacity,
                            checking: platformCopy.offlineChecking,
                            download: platformCopy.offlineDownload,
                            error: platformCopy.offlineError,
                            installing: platformCopy.offlineInstall,
                            integrity: platformCopy.offlineIntegrity,
                            progress: platformCopy.offlineProgress,
                            quota: platformCopy.offlineQuota,
                            ready: platformCopy.offlineReady,
                            remove: platformCopy.offlineRemove,
                            size: platformCopy.offlineSize,
                            update: platformCopy.offlineUpdate,
                            unavailable: platformCopy.offlineError,
                          }}
                          manifestUrl={BuildTrainingGameOfflineManifestHref(module)}
                          icon={<span className="material-symbols-outlined" aria-hidden="true">download</span>}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {visiblePublishedGames.length > 0 && (
            <div className="library-section-heading community-library-heading">
              <div>
                <p className="page-kicker">Developer library</p>
                <h3>{platformCopy.developerLibrary}</h3>
              </div>
              <span>{visiblePublishedGames.length}</span>
            </div>
          )}

          {visiblePublishedGames.length > 0 && (
            <div className="module-grid community-game-grid">
              {visiblePublishedGames.map((game) => {
                const theme = GetTrainingModuleTheme(game.category);
                const themeLabel = language === 'en' ? theme.label.en : theme.label['zh-TW'];
                return (
                  <article
                    className="module-card community-game-card"
                    key={game.release.id}
                    style={BuildTrainingThemeStyle(theme)}
                  >
                    <div className="community-game-visual" aria-hidden="true">
                      <TrainingThemeIcon decorative label={themeLabel} theme={theme} />
                      <small>jsPsych 8</small>
                    </div>
                    <div className="module-card-content">
                      <div className="module-card-meta">
                        <span>{themeLabel}</span>
                        <span className="module-card-theme-adornments">
                          <TrainingThemeBadge language={language} theme={theme} />
                          <span className="verified-release-badge">
                            <span className="material-symbols-outlined" aria-hidden="true">verified_user</span>
                            {platformCopy.reviewed}
                          </span>
                        </span>
                      </div>
                      <h3>{game.title}</h3>
                      <p>{game.summary || platformCopy.summaryFallback}</p>
                      <dl className="community-game-details">
                        <div><dt>{platformCopy.developer}</dt><dd>{game.developerName}</dd></div>
                        <div><dt>{platformCopy.version}</dt><dd>{game.release.version}</dd></div>
                      </dl>
                      <div className="community-game-actions">
                        <button onClick={() => setActivePackageGame(game)} type="button">
                          <span className="material-symbols-outlined" aria-hidden="true">play_arrow</span>
                          {platformCopy.play}
                        </button>
                        <a href={game.release.installUrl} rel="noopener noreferrer" target="_blank">
                          <span className="material-symbols-outlined" aria-hidden="true">download</span>
                          {platformCopy.install}
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {visibleModules.length === 0 && visiblePublishedGames.length === 0 && (
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
