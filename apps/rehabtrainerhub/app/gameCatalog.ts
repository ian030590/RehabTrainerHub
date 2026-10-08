import {
  BuildTrainingGameInstallHref, BuildTrainingModuleImageSrc,
  GetPublishedGameCategoryLabel, GetPublishedGameSubcategoryLabel,
  GetTrainingModuleCategoryLabel, GetTrainingModuleCopy, GetTrainingModuleSubcategoryLabel,
  GetTrainingModuleTheme, GetTrainingThemeId,
  type TrainingCatalogModule, type TrainingPurposeId, type TrainingVisualTheme,
} from '@rehab-trainer/hub-modules/catalog';
import { MergeHubGames } from './hubGames.js';
import { hubLocalName, hubName } from './hubBrand';
import officialGameReleases from '@rehab-trainer/ui/officialGameReleases.json';
import type { PublishedGame } from './publishedGames';
import type { HubLocale } from './i18n/types';

export interface HubGame {
  id: string;
  title: string;
  summary: string;
  author: string;
  version?: string;
  purpose: TrainingPurposeId | null;
  categoryLabel: string;
  subcategoryLabel: string;
  theme: TrainingVisualTheme;
  imageSrc?: string;
  installUrl: string;
  launch: { contract: 'catalog-v1'; module: TrainingCatalogModule } | { contract: 'package-v1'; game: PublishedGame };
}

export function BuildHubGameCatalog(modules: readonly TrainingCatalogModule[], releases: readonly PublishedGame[], locale: HubLocale): HubGame[] {
  const catalogGames: HubGame[] = modules.map(module => {
    const copy = GetTrainingModuleCopy(module, locale);
    return {
      id: module.runtimeId, title: copy.title, summary: copy.description,
      author: locale === 'en' ? hubName : hubLocalName, purpose: module.purpose,
      categoryLabel: GetTrainingModuleCategoryLabel(module, locale),
      subcategoryLabel: GetTrainingModuleSubcategoryLabel(module, locale),
      theme: GetTrainingModuleTheme(module), imageSrc: BuildTrainingModuleImageSrc(module),
      installUrl: BuildTrainingGameInstallHref(module), launch: { contract: 'catalog-v1', module },
    };
  });
  const publishedGames: HubGame[] = releases.map(game => ({
    id: game.slug, title: game.title, summary: game.summary, author: game.developerName,
    version: game.release.version, purpose: GetTrainingThemeId(game.category),
    categoryLabel: GetPublishedGameCategoryLabel(game.category, locale),
    subcategoryLabel: GetPublishedGameSubcategoryLabel(game.category, locale),
    theme: GetTrainingModuleTheme(game.category), installUrl: game.release.installUrl,
    launch: { contract: 'package-v1', game },
  }));
  const retainedCatalogIds = new Set(modules.filter(module => !Object.hasOwn(officialGameReleases, module.runtimeId))
    .map(module => module.runtimeId));
  return MergeHubGames(catalogGames, publishedGames, retainedCatalogIds);
}
