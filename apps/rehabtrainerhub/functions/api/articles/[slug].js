import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
} from '../../_lib/auth.js';
import {
  GetPublishedArticleBySlug,
  IsValidArticleSlug,
} from '../../_lib/articles.js';

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  const rawSlug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const slug = typeof rawSlug === 'string' ? rawSlug.trim().toLowerCase() : '';
  if (!IsValidArticleSlug(slug)) {
    return ErrorResponse(request, env, 'Invalid article slug.', 400);
  }

  try {
    const article = await GetPublishedArticleBySlug(env, slug);
    if (!article) return ErrorResponse(request, env, 'Article not found.', 404);
    return JsonResponse(request, env, { article }, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Unable to load a published education article.', error);
    return ErrorResponse(request, env, 'Unable to load the education article.', 500);
  }
}
