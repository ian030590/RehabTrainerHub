import {
  IsTrainerCategoryId,
  type TrainerCatalogId,
  type TrainingCatalogModule,
} from '@rehab-trainer/hub-modules/catalog';
import { IsGameTagPair } from '../games/gameTags.js';
import officialGameReleases from '@rehab-trainer/ui/officialGameReleases.json';

export interface PublishedGameRelease {
  id: string;
  version: string;
  contentSha256: string;
  capabilities: string[];
  approvedAt: string;
  launchUrl: string;
  installUrl: string;
  settingsUrl?: string;
  presentation?: 'game';
}

export interface PublishedGame {
  id: string;
  slug: string;
  title: string;
  summary: string;
  trainer: TrainerCatalogId;
  category: string;
  developerName: string;
  updatedAt: string;
  copy?: TrainingCatalogModule['copy'];
  previewUrl?: string;
  release: PublishedGameRelease;
}

export async function FetchPublishedGames(signal?: AbortSignal): Promise<PublishedGame[]> {
  const response = await fetch('/api/games', {
    credentials: 'same-origin',
    signal,
  });
  if (!response.ok) throw new Error(`Unable to load games. Status ${response.status}`);
  const payload = await response.json() as { games?: unknown };
  if (!Array.isArray(payload.games)) return [];
  return payload.games.filter(IsPublishedGame);
}

function IsPublishedGame(value: unknown): value is PublishedGame {
  if (!value || typeof value !== 'object') return false;
  const game = value as Partial<PublishedGame>;
  return typeof game.id === 'string'
    && typeof game.slug === 'string'
    && typeof game.title === 'string'
    && typeof game.summary === 'string'
    && IsTrainerCategoryId(game.trainer)
    && typeof game.category === 'string'
    && typeof game.developerName === 'string'
    && Boolean(game.release)
    && typeof game.release?.id === 'string'
    && typeof game.release.version === 'string'
    && Array.isArray(game.release.capabilities)
    && IsIsolatedRunnerUrl(game.release.launchUrl)
    && IsIsolatedRunnerUrl(game.release.installUrl)
    && (game.release.presentation === 'game'
      ? IsSelfContainedPublishedGame(game as PublishedGame)
      : game.release.presentation === undefined && IsIsolatedRunnerUrl(game.release.settingsUrl));
}

function IsSelfContainedPublishedGame(game: PublishedGame): boolean {
  const registered = officialGameReleases[game.slug as keyof typeof officialGameReleases];
  if (!registered || !IsGameTagPair(game.trainer, game.category) || !game.copy
    || [game.copy.en, game.copy['zh-TW']].some(copy => !copy
      || typeof copy.title !== 'string' || !copy.title.trim() || copy.title.length > 120
      || typeof copy.description !== 'string' || !copy.description.trim() || copy.description.length > 500)) return false;
  const launch = new URL(game.release.launchUrl);
  const basePath = `/games/${encodeURIComponent(game.slug)}/${encodeURIComponent(game.release.version)}/`;
  if (launch.origin !== new URL(registered.origin).origin || launch.pathname !== basePath) return false;
  if (game.previewUrl !== undefined) {
    if (!IsIsolatedRunnerUrl(game.previewUrl)) return false;
    const preview = new URL(game.previewUrl);
    if (preview.origin !== launch.origin || !preview.pathname.startsWith(`${basePath}package/`)
      || preview.search || preview.hash || !/\.(?:png|jpe?g|webp|avif)$/i.test(preview.pathname)) return false;
  }
  return true;
}

function IsIsolatedRunnerUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    const isLocal = url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const isTrainerHubSite = url.hostname === 'trainerhub.cc' || url.hostname.endsWith('.trainerhub.cc');
    return (url.protocol === 'https:' || isLocal)
      && !isTrainerHubSite
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}
