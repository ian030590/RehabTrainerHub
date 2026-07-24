import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
} from '../_lib/auth.js';
import { GetPublishedArticlesPage } from '../_lib/articles.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get('cursor') || '';
    const page = await GetPublishedArticlesPage(env, { cursor });
    return JsonResponse(request, env, page, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    if (error instanceof TypeError && /article cursor|page size/i.test(error.message)) {
      return ErrorResponse(request, env, 'Invalid article pagination.', 400);
    }
    console.error('Unable to load published education articles.', error);
    return ErrorResponse(request, env, 'Unable to load education articles.', 500);
  }
}
