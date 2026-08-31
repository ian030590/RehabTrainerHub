const immutableCacheControl = 'public, max-age=31536000, immutable';
const runtimeAssetPathPattern = /^\/(?:runtime-assets)\/(.+)$/;
const allowedKeyPattern = /^(?:ai\/(?:mediapipe\/tasks-vision\/[^/]+\/wasm\/[^/]+|mediapipe-models\/(?:hand_landmarker\/hand_landmarker\/float16\/1|pose_landmarker\/pose_landmarker_lite\/float16\/1|face_landmarker\/face_landmarker\/float16\/1)\/[^/]+|webgazer\/[^/]+\/(?:webgazer\.js|LICENSE\.md|mediapipe\/face_mesh\/[^/]+))|game-assets\/rehabtrainerhub\/(?:motor|vision|brain|mouth)\/[^/]+\/v[0-9]+\/[^/]+)$/i;

export async function onRequestGet(context) {
  return HandleAssetRequest(context, true);
}

export async function onRequestHead(context) {
  return HandleAssetRequest(context, false);
}

export function onRequestOptions({ request }) {
  const corsOrigin = GetAllowedCorsOrigin(request);
  if (request.headers.get('Origin') && !corsOrigin) {
    return new Response(null, { status: 403, headers: BaseHeaders() });
  }
  const headers = BaseHeaders();
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, If-None-Match');
  headers.set('Access-Control-Max-Age', '86400');
  ApplyCorsHeaders(headers, corsOrigin);
  return new Response(null, { status: 204, headers });
}

export function ParseRuntimeAssetKey(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = pathname.match(runtimeAssetPathPattern);
  if (!match) return null;

  const encodedSegments = match[1].split('/');
  let segments;
  try {
    segments = encodedSegments.map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
  if (segments.some((segment) => !segment || segment === '.' || segment === '..'
    || segment.includes('/') || segment.includes('\\') || /[\u0000-\u001f\u007f]/.test(segment))) {
    return null;
  }
  const key = segments.join('/');
  return allowedKeyPattern.test(key) ? key : null;
}

async function HandleAssetRequest({ request, env }, includeBody) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405, headers: BaseHeaders({ allow: 'GET, HEAD, OPTIONS' }) });
  }

  const key = ParseRuntimeAssetKey(new URL(request.url).pathname);
  if (!key) return NotFoundResponse();

  const corsOrigin = GetAllowedCorsOrigin(request);
  if (request.headers.get('Origin') && !corsOrigin) {
    return new Response('Forbidden', { status: 403, headers: BaseHeaders() });
  }

  const bucket = env?.ASSET_BUCKET;
  const getObject = includeBody ? bucket?.get : bucket?.head;
  if (typeof getObject !== 'function') {
    return new Response('Runtime asset storage is unavailable.', { status: 503, headers: BaseHeaders() });
  }

  let object;
  try {
    object = await getObject.call(bucket, key);
  } catch (error) {
    console.error('Unable to read a runtime asset.', error);
    return new Response('Runtime asset storage is unavailable.', { status: 503, headers: BaseHeaders() });
  }
  if (!object) return NotFoundResponse();

  const headers = BaseHeaders();
  const contentType = object.httpMetadata?.contentType || ContentTypeForKey(key);
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', immutableCacheControl);
  if (Number.isSafeInteger(object.size) && object.size >= 0) {
    headers.set('Content-Length', String(object.size));
  }
  if (object.httpEtag || object.etag) {
    const etag = object.httpEtag || `"${object.etag}"`;
    headers.set('ETag', etag);
    if (request.headers.get('If-None-Match') === etag) {
      ApplyCorsHeaders(headers, GetAllowedCorsOrigin(request));
      return new Response(null, { status: 304, headers });
    }
  }
  ApplyCorsHeaders(headers, corsOrigin);
  return new Response(includeBody ? object.body : null, { status: 200, headers });
}

function NotFoundResponse() {
  return new Response('Not Found', { status: 404, headers: BaseHeaders() });
}

function BaseHeaders(extra = {}) {
  const headers = new Headers({
    'X-Content-Type-Options': 'nosniff',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none';",
    ...extra,
  });
  return headers;
}

function ApplyCorsHeaders(headers, origin) {
  if (!origin) return;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Vary', 'Origin');
}

function GetAllowedCorsOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  let parsed;
  let requestUrl;
  try {
    parsed = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && IsLocalHost(parsed.hostname))) {
    return null;
  }
  return parsed.origin === requestUrl.origin ? parsed.origin : null;
}

function IsLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function ContentTypeForKey(key) {
  const extension = key.slice(key.lastIndexOf('.')).toLowerCase();
  return new Map([
    ['.js', 'text/javascript; charset=utf-8'],
    ['.md', 'text/plain; charset=utf-8'],
    ['.wasm', 'application/wasm'],
    ['.task', 'application/octet-stream'],
    ['.data', 'application/octet-stream'],
    ['.binarypb', 'application/octet-stream'],
    ['.png', 'image/png'],
    ['.glb', 'model/gltf-binary'],
  ]).get(extension) || 'application/octet-stream';
}
