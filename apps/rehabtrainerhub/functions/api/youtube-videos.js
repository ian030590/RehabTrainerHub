import { ErrorResponse, JsonResponse, OptionsResponse, RateLimitResponse, RejectDisallowedOrigin } from '../_lib/auth.js';

const defaultChannelId = 'UCHE7xFZ9I8rJzbrFXA-3L3w';
const defaultMaxResults = 12;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  const limitError = await RateLimitResponse(request, env, 'youtube-videos', { limit: 20, windowSeconds: 60 });
  if (limitError) return limitError;

  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) return ErrorResponse(request, env, 'YOUTUBE_API_KEY is not configured.', 500);

  const requestUrl = new URL(request.url);
  const channelId = NormalizeChannelId(requestUrl.searchParams.get('channelId')) || defaultChannelId;
  const maxResults = NormalizeMaxResults(requestUrl.searchParams.get('maxResults'));
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
    return ErrorResponse(request, env, 'Unable to load YouTube videos.', 502);
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

  return JsonResponse(request, env, { channelId, videos }, {
    headers: {
      'Cache-Control': 'public, max-age=300',
    },
  });
}

function NormalizeChannelId(value) {
  const channelId = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{12,80}$/.test(channelId) ? channelId : '';
}

function NormalizeMaxResults(value) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return defaultMaxResults;
  return Math.min(Math.max(parsed, 1), 24);
}
