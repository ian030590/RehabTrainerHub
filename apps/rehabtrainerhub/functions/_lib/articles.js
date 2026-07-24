import { RequireDatabase } from './auth.js';

export const articleStatuses = Object.freeze({
  draft: 'draft',
  published: 'published',
});

const articleStatusValues = new Set(Object.values(articleStatuses));
const publishedArticlesCacheKey = 'education-articles:published:v3';
const publishedArticleCacheKeyPrefix = 'education-article:published:v1:';
const publishedArticlesCacheTtlSeconds = 5 * 60;
const defaultPublishedPageSize = 24;
const maximumPublishedPageSize = 48;
const maximumAdminArticles = 500;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function ToArticleDto(row) {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary || ''),
    content: String(row.content || ''),
    category: String(row.category || ''),
    coverImageUrl: row.cover_image_url || null,
    status: articleStatusValues.has(row.status) ? row.status : articleStatuses.draft,
    authorName: row.author_name || 'Rehab Trainer Hub',
    publishedAt: row.published_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function ToArticleCardDto(row) {
  const article = ToArticleDto(row);
  delete article.content;
  return article;
}

export function CreateArticleSlug(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '');
  return normalized || fallback;
}

export function NormalizeArticleInput(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const fallbackSlug = String(options.fallbackSlug || '').trim();
  const title = NormalizeRequiredText(input.title, 160);
  const summary = NormalizeOptionalText(input.summary, 600);
  const content = NormalizeRequiredText(input.content, 100000);
  const category = NormalizeOptionalText(input.category, 80);
  const requestedSlug = input.slug === undefined
    ? CreateArticleSlug(title, fallbackSlug)
    : String(input.slug || '').trim().toLowerCase();
  const coverImageUrl = NormalizeCoverImageUrl(input.coverImageUrl);
  const status = input.status === undefined
    ? articleStatuses.draft
    : articleStatusValues.has(input.status)
      ? input.status
      : null;

  if (
    !title
    || !content
    || !requestedSlug
    || requestedSlug.length > 120
    || !slugPattern.test(requestedSlug)
    || summary === null
    || category === null
    || coverImageUrl === undefined
    || !status
  ) {
    return null;
  }

  return {
    slug: requestedSlug,
    title,
    summary,
    content,
    category,
    coverImageUrl,
    status,
  };
}

export function IsAllowedArticleCoverImageUrl(env, value) {
  if (!value || (value.startsWith('/') && !value.startsWith('//'))) return true;

  try {
    const configuredBaseUrl = new URL(String(env.ASSET_PUBLIC_BASE_URL || '').trim());
    const coverUrl = new URL(value);
    const basePath = configuredBaseUrl.pathname.replace(/\/+$/, '');
    const articlePathPrefix = `${basePath}/articles/`.replace(/^\/\//, '/');
    return configuredBaseUrl.protocol === 'https:'
      && coverUrl.protocol === 'https:'
      && coverUrl.origin === configuredBaseUrl.origin
      && coverUrl.pathname.startsWith(articlePathPrefix);
  } catch {
    return false;
  }
}

export function IsValidArticleSlug(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 120
    && slugPattern.test(value);
}

export async function GetPublishedArticles(env) {
  const page = await GetPublishedArticlesPage(env);
  return page.articles;
}

export async function GetPublishedArticlesPage(env, options = {}) {
  const cursor = String(options.cursor || '').trim();
  const limit = Number(options.limit || defaultPublishedPageSize);
  if (
    !Number.isSafeInteger(limit)
    || limit < 1
    || limit > maximumPublishedPageSize
  ) {
    throw new TypeError('Invalid article page size.');
  }
  const decodedCursor = cursor ? ParsePublishedArticlesCursor(cursor) : null;
  if (cursor && !decodedCursor) throw new TypeError('Invalid article cursor.');

  const cache = GetArticleCache(env);
  const useCache = !cursor && limit === defaultPublishedPageSize;
  if (cache && useCache) {
    try {
      const cached = await cache.get(publishedArticlesCacheKey, 'json');
      if (IsArticlePage(cached)) return cached;
    } catch (error) {
      console.warn('Unable to read the article cache. Falling back to D1.', error);
    }
  }

  const cursorSql = decodedCursor
    ? `AND (
        education_articles.published_at < ?
        OR (
          education_articles.published_at = ?
          AND (
            education_articles.updated_at < ?
            OR (
              education_articles.updated_at = ?
              AND education_articles.id < ?
            )
          )
        )
      )`
    : '';
  const cursorBindings = decodedCursor
    ? [
        decodedCursor.publishedAt,
        decodedCursor.publishedAt,
        decodedCursor.updatedAt,
        decodedCursor.updatedAt,
        decodedCursor.id,
      ]
    : [];
  const result = await RequireDatabase(env)
    .prepare(`${ArticleCardSelectSql()}
      WHERE education_articles.status = 'published'
      ${cursorSql}
      ORDER BY
        education_articles.published_at DESC,
        education_articles.updated_at DESC,
        education_articles.id DESC
      LIMIT ?
    `)
    .bind(...cursorBindings, limit + 1)
    .all();
  const rows = result.results || [];
  const pageRows = rows.slice(0, limit);
  const page = {
    articles: pageRows.map(ToArticleCardDto),
    nextCursor: rows.length > limit
      ? CreatePublishedArticlesCursor(pageRows.at(-1))
      : null,
  };

  if (cache && useCache) {
    try {
      await cache.put(
        publishedArticlesCacheKey,
        JSON.stringify(page),
        { expirationTtl: publishedArticlesCacheTtlSeconds },
      );
    } catch (error) {
      console.warn('Unable to populate the article cache.', error);
    }
  }
  return page;
}

export async function GetPublishedArticleBySlug(env, slug) {
  if (!IsValidArticleSlug(slug)) return null;

  const cache = GetArticleCache(env);
  const cacheKey = `${publishedArticleCacheKeyPrefix}${slug}`;
  if (cache) {
    try {
      const cached = await cache.get(cacheKey, 'json');
      if (cached && typeof cached === 'object' && !Array.isArray(cached)) return cached;
    } catch (error) {
      console.warn('Unable to read the article detail cache. Falling back to D1.', error);
    }
  }

  const row = await RequireDatabase(env)
    .prepare(`${ArticleSelectSql()}
      WHERE education_articles.status = 'published'
        AND education_articles.slug = ?
      LIMIT 1
    `)
    .bind(slug)
    .first();
  const article = row ? ToArticleDto(row) : null;

  if (cache && article) {
    try {
      await cache.put(
        cacheKey,
        JSON.stringify(article),
        { expirationTtl: publishedArticlesCacheTtlSeconds },
      );
    } catch (error) {
      console.warn('Unable to populate the article detail cache.', error);
    }
  }
  return article;
}

export async function GetAdminArticles(env, options = {}) {
  const authorUserId = String(options.authorUserId || '').trim();
  const whereSql = authorUserId
    ? 'WHERE education_articles.author_user_id = ?'
    : '';
  const statement = RequireDatabase(env)
    .prepare(`${ArticleCardSelectSql()}
      ${whereSql}
      ORDER BY education_articles.updated_at DESC
      LIMIT ?
    `)
  const result = authorUserId
    ? await statement.bind(authorUserId, maximumAdminArticles).all()
    : await statement.bind(maximumAdminArticles).all();
  return (result.results || []).map(ToArticleCardDto);
}

export async function GetArticleById(env, articleId, options = {}) {
  const authorUserId = String(options.authorUserId || '').trim();
  const authorSql = authorUserId
    ? 'AND education_articles.author_user_id = ?'
    : '';
  const statement = RequireDatabase(env)
    .prepare(`${ArticleSelectSql()}
      WHERE education_articles.id = ?
        ${authorSql}
      LIMIT 1
    `)
  const row = authorUserId
    ? await statement.bind(articleId, authorUserId).first()
    : await statement.bind(articleId).first();
  return row ? ToArticleDto(row) : null;
}

export async function InvalidateArticleCache(env, slugs = []) {
  const cache = GetArticleCache(env);
  if (!cache) return;
  try {
    const keys = [
      publishedArticlesCacheKey,
      ...new Set(
        slugs
          .filter(IsValidArticleSlug)
          .map((slug) => `${publishedArticleCacheKeyPrefix}${slug}`),
      ),
    ];
    await Promise.all(keys.map((key) => cache.delete(key)));
  } catch (error) {
    console.warn('Unable to invalidate the article cache.', error);
  }
}

export async function DeleteUnusedArticleCoverAsset(env, coverImageUrl) {
  const assetKey = GetManagedArticleAssetKey(env, coverImageUrl);
  if (!assetKey || typeof env.ASSET_BUCKET?.delete !== 'function') return;

  try {
    const reference = await RequireDatabase(env)
      .prepare(`
        SELECT 1 AS referenced
        FROM education_articles
        WHERE cover_image_url = ?
        LIMIT 1
      `)
      .bind(coverImageUrl)
      .first();
    if (!reference?.referenced) await env.ASSET_BUCKET.delete(assetKey);
  } catch (error) {
    console.warn('Unable to clean up an unused article cover asset.', error);
  }
}

function ArticleSelectSql() {
  return `
    SELECT
      education_articles.id,
      education_articles.slug,
      education_articles.title,
      education_articles.summary,
      education_articles.content,
      education_articles.category,
      education_articles.cover_image_url,
      education_articles.status,
      education_articles.published_at,
      education_articles.created_at,
      education_articles.updated_at,
      COALESCE(NULLIF(TRIM(app_users.display_name), ''), '治療師團隊') AS author_name
    FROM education_articles
    LEFT JOIN app_users ON app_users.id = education_articles.author_user_id
  `;
}

function ArticleCardSelectSql() {
  return `
    SELECT
      education_articles.id,
      education_articles.slug,
      education_articles.title,
      education_articles.summary,
      education_articles.category,
      education_articles.cover_image_url,
      education_articles.status,
      education_articles.published_at,
      education_articles.created_at,
      education_articles.updated_at,
      COALESCE(NULLIF(TRIM(app_users.display_name), ''), '治療師團隊') AS author_name
    FROM education_articles
    LEFT JOIN app_users ON app_users.id = education_articles.author_user_id
  `;
}

function GetArticleCache(env) {
  const cache = env.ARTICLE_CACHE;
  return cache
    && typeof cache.get === 'function'
    && typeof cache.put === 'function'
    && typeof cache.delete === 'function'
    ? cache
    : null;
}

function CreatePublishedArticlesCursor(row) {
  if (!row?.published_at || !row?.updated_at || !row?.id) return null;
  return btoa(JSON.stringify([row.published_at, row.updated_at, row.id]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function ParsePublishedArticlesCursor(value) {
  if (
    typeof value !== 'string'
    || value.length > 1024
    || !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    return null;
  }
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(
      atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')),
    );
    if (
      !Array.isArray(decoded)
      || decoded.length !== 3
      || decoded.some((item) => typeof item !== 'string')
      || decoded[0].length > 64
      || decoded[1].length > 64
      || decoded[2].length > 128
    ) {
      return null;
    }
    return {
      publishedAt: decoded[0],
      updatedAt: decoded[1],
      id: decoded[2],
    };
  } catch {
    return null;
  }
}

function IsArticlePage(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Array.isArray(value.articles)
    && (value.nextCursor === null || typeof value.nextCursor === 'string'),
  );
}

function GetManagedArticleAssetKey(env, value) {
  if (!IsAllowedArticleCoverImageUrl(env, value) || !value || value.startsWith('/')) {
    return null;
  }

  try {
    const configuredBaseUrl = new URL(String(env.ASSET_PUBLIC_BASE_URL || '').trim());
    const coverUrl = new URL(value);
    const basePath = configuredBaseUrl.pathname.replace(/\/+$/, '');
    const relativePath = coverUrl.pathname.slice(basePath.length).replace(/^\/+/, '');
    return relativePath.startsWith('articles/') ? relativePath : null;
  } catch {
    return null;
  }
}

function NormalizeRequiredText(value, maxLength) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : '';
}

function NormalizeOptionalText(value, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : null;
}

function NormalizeCoverImageUrl(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return value.startsWith('/') && !value.startsWith('//') ? value : undefined;
  }
}
