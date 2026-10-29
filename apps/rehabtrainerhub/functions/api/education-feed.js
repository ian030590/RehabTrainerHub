import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
} from '../_lib/auth.js';
import { ReadJsonBody } from '../_lib/request.js';

// Query parameters are ignored; neither the upstream nor the cache key is caller-controlled.
const blogPostsUrl = 'https://www.googleapis.com/blogger/v3/blogs/8849463716377519690/posts';
const cacheUrl = 'https://trainerhub.cc/api/education-feed?cache=blogger-v1';
const educationCategories = ['中風復健', '視覺復健', '動作復健', '認知復健'];
const maximumPageBytes = 2 * 1024 * 1024;
const feedTimeoutMs = 8000;
const cacheSeconds = 600;
const cacheHeaders = { 'Cache-Control': `public, max-age=${cacheSeconds}` };
const htmlEntities = { amp: '&', apos: "'", gt: '>', lt: '<', quot: '"', nbsp: ' ' };

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;
  if (typeof env.BLOGGER_API_KEY !== 'string' || !env.BLOGGER_API_KEY.trim()) {
    console.warn('Education feed unavailable: BLOGGER_API_KEY is not configured.');
    return ErrorResponse(request, env, 'The education feed is unavailable.', 503);
  }

  const cache = globalThis.caches?.default;
  try {
    const cached = await cache?.match(cacheUrl);
    if (cached?.ok) {
      const body = await cached.json();
      if (Array.isArray(body?.links)) return JsonResponse(request, env, body, { headers: cacheHeaders });
    }
  } catch {
    // The optional cache must not prevent a fresh upstream request.
  }

  try {
    const links = await ReadEducationFeed(env.BLOGGER_API_KEY);
    const body = { links };
    try {
      await cache?.put(cacheUrl, Response.json(body, { headers: cacheHeaders }));
    } catch {
      // A successful upstream response is still usable when the cache cannot write.
    }
    return JsonResponse(request, env, body, { headers: cacheHeaders });
  } catch {
    // Upstream errors can echo credentials, so only fixed text reaches logs.
    console.warn('Education feed unavailable: Blogger request failed.');
    return ErrorResponse(request, env, 'The education feed is unavailable.', 502);
  }
}

async function ReadEducationFeed(apiKey) {
  const posts = [];
  const seenTokens = new Set();
  let pageToken = '';
  for (let page = 0; page < 4; page++) {
    const url = new URL(blogPostsUrl);
    url.search = new URLSearchParams({
      maxResults: '50', fetchBodies: 'true', fetchImages: 'false', orderBy: 'published',
      fields: 'nextPageToken,items(id,title,content,url,labels,published,author/displayName)',
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const response = await fetch(url.href, {
      headers: { Accept: 'application/json', 'X-Goog-Api-Key': apiKey },
      // Workers reject redirect: 'error'; 'manual' plus the 200-only check below refuses redirects.
      redirect: 'manual',
      signal: AbortSignal.timeout(feedTimeoutMs),
    });
    if (response.status !== 200) throw new Error('upstream status');
    if (!/^application\/json(?:\s*;|\s*$)/i.test(response.headers.get('Content-Type') || '')) {
      throw new Error('upstream is not JSON');
    }
    const parsed = await ReadJsonBody(response, maximumPageBytes);
    const body = parsed.value;
    if (!parsed.ok || !body || typeof body !== 'object' || Array.isArray(body)
      || (body.items !== undefined && !Array.isArray(body.items))) throw new Error('invalid upstream body');
    posts.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (typeof pageToken !== 'string' || !pageToken || seenTokens.has(pageToken)) break;
    seenTokens.add(pageToken);
  }

  const links = posts.map(NormalisePost).filter(Boolean)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const seenUrls = new Set();
  return links.filter(link => {
    if (seenUrls.has(link.url)) return false;
    seenUrls.add(link.url);
    return true;
  });
}

function PlainText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name) => {
    if (name[0] !== '#') return Object.hasOwn(htmlEntities, name.toLowerCase()) ? htmlEntities[name.toLowerCase()] : entity;
    const codePoint = name[1].toLowerCase() === 'x'
      ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return codePoint > 0 && codePoint <= 0x10ffff && !(codePoint >= 0xd800 && codePoint <= 0xdfff)
      ? String.fromCodePoint(codePoint) : entity;
  })
    .replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(?:p|div|br|li|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, ' ').trim();
}

function NormalisePost(post) {
  if (!post || typeof post !== 'object' || !Array.isArray(post.labels)) return null;
  const categories = educationCategories.filter(category => post.labels.includes(category));
  const title = PlainText(post.title);
  if (!categories.length || !title || typeof post.url !== 'string') return null;
  let url;
  try {
    url = new URL(post.url);
    if (!['https:', 'http:'].includes(url.protocol) || url.host !== 'blog.trainerhub.cc'
      || url.username || url.password) return null;
    url.protocol = 'https:';
  } catch {
    return null;
  }
  const content = typeof post.content === 'string' ? post.content : '';
  let summary = '';
  for (const [, paragraph] of content.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p\s*>/gi)) {
    summary = PlainText(paragraph);
    if (summary) break;
  }
  const date = typeof post.published === 'string' ? new Date(post.published) : new Date(NaN);
  return {
    title,
    summary: Array.from(summary || PlainText(content)).slice(0, 160).join('').trim(),
    url: url.href,
    categories,
    authorName: PlainText(post.author?.displayName),
    publishedAt: Number.isNaN(date.getTime()) ? '' : date.toISOString(),
  };
}
