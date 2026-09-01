import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../_lib/auth.js';

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
    const games = (result.results || []).map((row) => {
      const releasePath = `/games/${encodeURIComponent(row.slug)}/${encodeURIComponent(row.version)}/`;
      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
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
