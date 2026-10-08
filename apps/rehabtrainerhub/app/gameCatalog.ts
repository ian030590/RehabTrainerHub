import {
  BuildTrainingGameInstallHref,
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
    const approved = Object.hasOwn(officialGameReleases, module.runtimeId)
      ? releases.find(game => game.slug === module.runtimeId && game.release.presentation === 'game') : undefined;
    const purpose = GetTrainingThemeId(approved?.category);
    const launchModule = approved && purpose && approved.copy ? {
      ...module, trainer: approved.trainer, category: approved.trainer, purpose, subcategory: purpose, copy: approved.copy,
    } : module;
    const copy = GetTrainingModuleCopy(launchModule, locale);
    return {
      id: module.runtimeId, title: copy.title, summary: copy.description,
      author: approved?.developerName ?? (locale === 'en' ? hubName : hubLocalName),
      version: approved?.release.version, purpose: launchModule.purpose,
      categoryLabel: GetTrainingModuleCategoryLabel(launchModule, locale),
      subcategoryLabel: GetTrainingModuleSubcategoryLabel(launchModule, locale),
      theme: GetTrainingModuleTheme(launchModule), imageSrc: approved?.previewUrl ?? module.imagePath,
      installUrl: approved?.release.installUrl ?? BuildTrainingGameInstallHref(module),
      launch: { contract: 'catalog-v1', module: launchModule },
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
  return MergeHubGames(catalogGames, publishedGames);
}
