import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RejectDisallowedOrigin,
} from '../_lib/auth.js';

// Fixed upstream: the personal site sends no CORS headers, so the Hub reads it
// for the browser. Query parameters are ignored on purpose.
const educationFeedUrl = 'https://ian.trainerhub.cc/rss.xml';
const maximumFeedBytes = 1024 * 1024;
const feedTimeoutMs = 8000;
const cacheSeconds = 600;

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestGet({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const xml = await ReadEducationFeed();
    return JsonResponse(request, env, { xml }, {
      headers: { 'Cache-Control': `public, max-age=${cacheSeconds}` },
    });
  } catch (error) {
    console.warn('Education feed unavailable:', error instanceof Error ? error.message : 'unknown error');
    return ErrorResponse(request, env, 'The education feed is unavailable.', 502);
  }
}

async function ReadEducationFeed() {
  const response = await fetch(educationFeedUrl, {
    headers: { Accept: 'application/rss+xml, application/xml' },
    signal: AbortSignal.timeout(feedTimeoutMs),
    cf: { cacheEverything: true, cacheTtl: cacheSeconds },
  });
  if (!response.ok) throw new Error(`upstream status ${response.status}`);
  const contentType = response.headers.get('Content-Type') || '';
  if (!/^(application|text)\/(rss\+)?xml\b/i.test(contentType)) throw new Error('upstream is not XML');
  const declaredLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumFeedBytes) throw new Error('upstream feed is too large');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maximumFeedBytes) throw new Error('upstream feed is too large');
  const xml = new TextDecoder().decode(bytes);
  if (!/<rss[\s>]/.test(xml)) throw new Error('upstream is not an RSS document');
  return xml;
}
