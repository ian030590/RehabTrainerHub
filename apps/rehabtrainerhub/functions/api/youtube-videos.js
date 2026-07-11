import { errorResponse, jsonResponse, optionsResponse, rateLimitResponse, rejectDisallowedOrigin } from '../_lib/auth.js';

const DEFAULT_CHANNEL_ID = 'UCHE7xFZ9I8rJzbrFXA-3L3w';
const DEFAULT_MAX_RESULTS = 12;

export function onRequestOptions({ request, env }) {
  return optionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = rejectDisallowedOrigin(request, env);
  if (originError) return originError;
  const limitError = await rateLimitResponse(request, env, 'youtube-videos', { limit: 20, windowSeconds: 60 });
  if (limitError) return limitError;

  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) return errorResponse(request, env, 'YOUTUBE_API_KEY is not configured.', 500);

  const requestUrl = new URL(request.url);
  const channelId = normalizeChannelId(requestUrl.searchParams.get('channelId')) || DEFAULT_CHANNEL_ID;
  const maxResults = normalizeMaxResults(requestUrl.searchParams.get('maxResults'));
  const youtubeUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  youtubeUrl.search = new URLSearchParams({
    part: 'snippet',
    channelId,
    key: apiKey,
    maxResults: String(maxResults),
    order: 'date',
    type: 'video',
    fields: 'items(id/videoId,snippet/title,snippet/description,snippet/publishedAt)',
  }).toString();

  const response = await fetch(youtubeUrl.toString(), {
    headers: { Accept: 'application/json' },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    return errorResponse(request, env, 'Unable to load YouTube videos.', 502);
  }

  const videos = (data.items || [])
    .map((item) => {
      const id = item?.id?.videoId;
      const snippet = item?.snippet || {};
      if (!id || !snippet.title || !snippet.publishedAt) return null;

      return {
        id,
        title: snippet.title,
        description: snippet.description || '',
        publishedAt: snippet.publishedAt,
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    })
    .filter(Boolean);

  return jsonResponse(request, env, { channelId, videos }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function normalizeChannelId(value) {
  const channelId = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{12,80}$/.test(channelId) ? channelId : '';
}

function normalizeMaxResults(value) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_MAX_RESULTS;
  return Math.min(Math.max(parsed, 1), 24);
}
