import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../_lib/auth.js';
import { officialGameReleases } from '../_lib/officialGames.js';
import { ReadReleasedGameCatalog } from '../_lib/gameCatalog.js';
import { ReadOfficialGameRelease } from '../../../usergamerunner/functions/_lib/officialCatalog.js';
import { EncodePackagePath } from '../../../usergamerunner/functions/_lib/release.js';

const defaultGameRunnerOrigin = 'https://trainerhub-user-games.pages.dev';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const runnerOrigin = GetGameRunnerOrigin(env);
    if (!runnerOrigin) {
      return ErrorResponse(request, env, 'The isolated game runner origin is invalid.', 503);
    }
    const result = await RequireDatabase(env)
      .prepare(`
        SELECT
          developer_games.id,
          developer_games.slug,
          developer_games.title,
          developer_games.summary,
          developer_games.trainer,
          developer_games.category,
          developer_games.updated_at,
          developer_games.developer_display_name,
          game_releases.id AS release_id,
          game_releases.version,
          game_releases.content_sha256,
          game_releases.capabilities_json,
          game_releases.reviewed_at
        FROM developer_games
        INNER JOIN game_releases
          ON game_releases.id = developer_games.active_release_id
         AND game_releases.game_id = developer_games.id
         AND game_releases.status = 'approved'
        WHERE developer_games.status = 'published'
        ORDER BY developer_games.updated_at DESC, developer_games.slug
        LIMIT 500
      `)
      .all();
    const games = (result.results || []).filter(row => !Object.hasOwn(officialGameReleases, row.slug)).map((row) => {
      const releasePath = `/games/${encodeURIComponent(row.slug)}/${encodeURIComponent(row.version)}/`;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        trainer: row.trainer,
        category: row.category,
        developerName: row.developer_display_name,
        updatedAt: row.updated_at,
        release: {
          id: row.release_id,
          version: row.version,
          contentSha256: row.content_sha256,
          capabilities: SafeJson(row.capabilities_json, []),
          approvedAt: row.reviewed_at,
          launchUrl: `${runnerOrigin}${releasePath}`,
          installUrl: `${runnerOrigin}${releasePath}`,
          settingsUrl: `${runnerOrigin}${releasePath}package/settings.json`,
        },
      };
    });
    const currentGames = await Promise.allSettled(Object.keys(officialGameReleases).map(async gameId => {
      const release = await ReadOfficialGameRelease(env.GAME_RELEASE_BUCKET, gameId);
      if (!release) return null;
      const catalog = await ReadReleasedGameCatalog(env.GAME_RELEASE_BUCKET, release);
      if (!catalog) return null;
      const { metadata, preview } = catalog;
      const releasePath = `/games/${encodeURIComponent(gameId)}/${encodeURIComponent(release.version)}/`;
      return { id: gameId, slug: gameId, title: metadata.copy['zh-TW'].title,
        summary: metadata.copy['zh-TW'].description, trainer: metadata.trainer, category: metadata.category,
        developerName: metadata.author, updatedAt: release.approvedAt, copy: metadata.copy,
        ...(preview ? { previewUrl: `${runnerOrigin}${releasePath}package/${EncodePackagePath(preview)}` } : {}),
        release: { id: `${gameId}@${release.version}`, version: release.version, contentSha256: release.contentSha256,
          capabilities: release.capabilities, approvedAt: release.approvedAt, presentation: release.presentation,
          launchUrl: `${runnerOrigin}${releasePath}`, installUrl: `${runnerOrigin}/games/${encodeURIComponent(gameId)}/` },
      };
    }));
    for (const current of currentGames) {
      if (current.status === 'fulfilled' && current.value) games.push(current.value);
      if (current.status === 'rejected') console.error('Unable to load an approved game catalog.', current.reason);
    }
    return JsonResponse(request, env, { games }, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Unable to load the published game catalog.', error);
    return ErrorResponse(request, env, 'Unable to load games.', 500);
  }
}

function GetGameRunnerOrigin(env) {
  try {
    const url = new URL(String(env.GAME_RUNNER_ORIGIN || defaultGameRunnerOrigin).trim());
    const isLocal = url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const isTrainerHubSite = url.hostname === 'trainerhub.cc' || url.hostname.endsWith('.trainerhub.cc');
    if (
      (url.protocol !== 'https:' && !isLocal)
      || isTrainerHubSite
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function SafeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
