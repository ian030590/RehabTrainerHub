import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../_lib/auth.js';
import {
  CreateArticleSlug,
  GetAdminArticles,
  GetArticleById,
  InvalidateArticleCache,
  IsAllowedArticleCoverImageUrl,
  NormalizeArticleInput,
  articleStatuses,
} from '../../_lib/articles.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
  IsStaffUser,
} from '../../_lib/authorization.js';
import { ReadJsonBody } from '../../_lib/request.js';

const maxArticleBodyBytes = 128 * 1024;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const authorUserId = user.role === 'admin' ? null : user.id;
    return JsonResponse(request, env, {
      articles: await GetAdminArticles(env, { authorUserId }),
    });
  } catch (error) {
    console.error('Unable to load education articles for staff.', error);
    return ErrorResponse(request, env, 'Unable to load education articles.', 500);
  }
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const body = await ReadJsonBody(request, maxArticleBodyBytes);
    if (!body.ok) {
      return ErrorResponse(
        request,
        env,
        body.reason === 'too-large' ? 'Article payload is too large.' : 'Invalid JSON payload.',
        body.reason === 'too-large' ? 413 : 400,
      );
    }
    const input = body.value;
    const id = crypto.randomUUID();
    const normalized = NormalizeArticleInput(input, {
      fallbackSlug: CreateArticleSlug(input?.title, `article-${id.slice(0, 8)}`),
    });
    if (!normalized) return ErrorResponse(request, env, 'Invalid article payload.', 400);
    if (!IsAllowedArticleCoverImageUrl(env, normalized.coverImageUrl)) {
      return ErrorResponse(request, env, 'Article cover URL is not allowed.', 400);
    }

    const now = new Date().toISOString();
    const publishedAt = normalized.status === articleStatuses.published ? now : null;
    const db = RequireDatabase(env);
    await db.batch([
      db
      .prepare(`
        INSERT INTO education_articles (
          id, slug, title, summary, content, category, cover_image_url,
          status, author_user_id, published_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        normalized.slug,
        normalized.title,
        normalized.summary,
        normalized.content,
        normalized.category,
        normalized.coverImageUrl,
        normalized.status,
        user.id,
        publishedAt,
        now,
        now,
      ),
      CreateAdminAuditStatement(db, {
        actorUserId: user.id,
        action: 'education_article.create',
        targetType: 'education_article',
        targetId: id,
        metadata: {
          slug: normalized.slug,
          status: normalized.status,
        },
      }),
    ]);

    await InvalidateArticleCache(env, [normalized.slug]);
    const article = await GetArticleById(env, id);
    return JsonResponse(request, env, { article }, { status: 201 });
  } catch (error) {
    if (IsArticleSlugConflict(error)) {
      return ErrorResponse(request, env, 'Article slug already exists.', 409);
    }
    console.error('Unable to create an education article.', error);
    return ErrorResponse(request, env, 'Unable to create the education article.', 500);
  }
}

function IsArticleSlugConflict(error) {
  return /UNIQUE|education_articles\.slug/i.test(String(error));
}
