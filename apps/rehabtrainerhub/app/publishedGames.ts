import {
  gamePlatformLicenses,
  type GamePlatformLicense,
} from '@rehab-trainer/training-contracts';

export interface PublishedGameRelease {
  id: string;
  version: string;
  contentSha256: string;
  capabilities: string[];
  approvedAt: string;
  launchUrl: string;
  installUrl: string;
  license: GamePlatformLicense;
}

export interface PublishedGame {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  developerName: string;
  updatedAt: string;
  publisherType: 'third-party';
  resultTrust: 'client_reported';
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
    && typeof game.category === 'string'
    && typeof game.developerName === 'string'
    && game.publisherType === 'third-party'
    && game.resultTrust === 'client_reported'
    && Boolean(game.release)
    && typeof game.release?.id === 'string'
    && typeof game.release.version === 'string'
    && Array.isArray(game.release.capabilities)
    && IsGameLicense(game.release.license)
    && IsIsolatedRunnerUrl(game.release.launchUrl)
    && IsIsolatedRunnerUrl(game.release.installUrl);
}

function IsGameLicense(value: unknown): value is GamePlatformLicense {
  if (!value || typeof value !== 'object') return false;
  const license = value as Partial<GamePlatformLicense>;
  if (typeof license.id !== 'string') return false;
  const knownLicense = gamePlatformLicenses.find((candidate) => candidate.id === license.id);
  return Boolean(knownLicense)
    && license.label === knownLicense?.label
    && license.url === knownLicense?.url;
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
