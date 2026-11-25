import type { TrainingCatalogModule } from '@rehab-trainer/hub-modules/catalog';
import type { HubLabel } from './i18n/types';

export type ActivityLink = { id: string; href: string; title: HubLabel };

export function BuildActivityHref(gameId: string) {
  return `/activities/${encodeURIComponent(gameId)}/`;
}

export function BuildActivityLink(module: TrainingCatalogModule): ActivityLink {
  return {
    id: module.runtimeId,
    href: BuildActivityHref(module.runtimeId),
    title: { 'zh-TW': module.copy['zh-TW'].title, en: module.copy.en.title },
  };
}
