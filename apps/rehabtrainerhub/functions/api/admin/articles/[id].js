import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
  RequireDatabase,
} from '../../../_lib/auth.js';
import {
  DeleteUnusedArticleCoverAsset,
  GetArticleById,
  InvalidateArticleCache,
  IsAllowedArticleCoverImageUrl,
  NormalizeArticleInput,
  articleStatuses,
} from '../../../_lib/articles.js';
import {
  CreateAdminAuditStatement,
  GetAuthenticatedUser,
  IsStaffUser,
} from '../../../_lib/authorization.js';
import { ReadJsonBody } from '../../../_lib/request.js';

const maxArticleBodyBytes = 128 * 1024;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const articleId = NormalizeArticleId(params?.id);
    if (!articleId) return ErrorResponse(request, env, 'Invalid article id.', 400);
    const authorUserId = user.role === 'admin' ? null : user.id;
    const article = await GetArticleById(env, articleId, { authorUserId });
    return article
      ? JsonResponse(request, env, { article })
      : ErrorResponse(request, env, 'Article not found.', 404);
  } catch (error) {
    console.error('Unable to load an education article for staff.', error);
    return ErrorResponse(request, env, 'Unable to load the education article.', 500);
  }
}

export async function onRequestPut({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const articleId = NormalizeArticleId(params?.id);
    if (!articleId) return ErrorResponse(request, env, 'Invalid article id.', 400);

    const authorUserId = user.role === 'admin' ? null : user.id;
    const current = await GetArticleById(env, articleId, { authorUserId });
    if (!current) return ErrorResponse(request, env, 'Article not found.', 404);

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
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return ErrorResponse(request, env, 'Invalid article payload.', 400);
    }
    const normalized = NormalizeArticleInput({
      slug: input.slug === undefined ? current.slug : input.slug,
      title: input.title === undefined ? current.title : input.title,
      summary: input.summary === undefined ? current.summary : input.summary,
      content: input.content === undefined ? current.content : input.content,
      category: input.category === undefined ? current.category : input.category,
      coverImageUrl: input.coverImageUrl === undefined
        ? current.coverImageUrl
        : input.coverImageUrl,
      status: input.status === undefined ? current.status : input.status,
    });
    if (!normalized) return ErrorResponse(request, env, 'Invalid article payload.', 400);
    if (!IsAllowedArticleCoverImageUrl(env, normalized.coverImageUrl)) {
      return ErrorResponse(request, env, 'Article cover URL is not allowed.', 400);
    }

    const now = new Date().toISOString();
    const publishedAt = normalized.status === articleStatuses.published
      ? current.publishedAt || now
      : null;
    const db = RequireDatabase(env);
    await db.batch([
      db
      .prepare(`
        UPDATE education_articles
        SET
          slug = ?,
          title = ?,
          summary = ?,
          content = ?,
          category = ?,
          cover_image_url = ?,
          status = ?,
          published_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .bind(
        normalized.slug,
        normalized.title,
        normalized.summary,
        normalized.content,
        normalized.category,
        normalized.coverImageUrl,
        normalized.status,
        publishedAt,
        now,
        articleId,
      ),
      CreateAdminAuditStatement(db, {
        actorUserId: user.id,
        action: 'education_article.update',
        targetType: 'education_article',
        targetId: articleId,
        metadata: {
          slug: normalized.slug,
          status: normalized.status,
        },
      }),
    ]);

    await InvalidateArticleCache(env, [current.slug, normalized.slug]);
    if (current.coverImageUrl && current.coverImageUrl !== normalized.coverImageUrl) {
      await DeleteUnusedArticleCoverAsset(env, current.coverImageUrl);
    }
    return JsonResponse(request, env, { article: await GetArticleById(env, articleId) });
  } catch (error) {
    if (IsArticleSlugConflict(error)) {
      return ErrorResponse(request, env, 'Article slug already exists.', 409);
    }
    console.error('Unable to update an education article.', error);
    return ErrorResponse(request, env, 'Unable to update the education article.', 500);
  }
}

export async function onRequestDelete({ request, env, params }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const articleId = NormalizeArticleId(params?.id);
    if (!articleId) return ErrorResponse(request, env, 'Invalid article id.', 400);

    const authorUserId = user.role === 'admin' ? null : user.id;
    const current = await GetArticleById(env, articleId, { authorUserId });
    if (!current) return ErrorResponse(request, env, 'Article not found.', 404);

    const db = RequireDatabase(env);
    await db.batch([
      db
        .prepare('DELETE FROM education_articles WHERE id = ?')
        .bind(articleId),
      CreateAdminAuditStatement(db, {
        actorUserId: user.id,
        action: 'education_article.delete',
        targetType: 'education_article',
        targetId: articleId,
        metadata: {
          slug: current.slug,
          status: current.status,
        },
      }),
    ]);
    await InvalidateArticleCache(env, [current.slug]);
    await DeleteUnusedArticleCoverAsset(env, current.coverImageUrl);
    return JsonResponse(request, env, { ok: true });
  } catch (error) {
    console.error('Unable to delete an education article.', error);
    return ErrorResponse(request, env, 'Unable to delete the education article.', 500);
  }
}

function NormalizeArticleId(value) {
  const id = Array.isArray(value) ? value[0] : value;
  return typeof id === 'string' && id.length > 0 && id.length <= 128 ? id : null;
}

function IsArticleSlugConflict(error) {
  return /UNIQUE|education_articles\.slug/i.test(String(error));
}
