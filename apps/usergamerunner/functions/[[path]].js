import {
  ContentTypeForPath,
  PackageKey,
  ParseGameRoute,
  ReleaseKey,
  ReleaseValidationError,
  ValidateRelease,
  maxReleaseBytes,
} from './_lib/release.js';
import {
  RenderIcon,
  RenderLauncher,
  RenderManifest,
  RenderServiceWorker,
  trustedPlatformOrigin,
} from './_lib/render.js';

const commonPermissionsPolicy = [
  'accelerometer=()',
  'ambient-light-sensor=()',
  'camera=()',
  'display-capture=()',
  'geolocation=()',
  'gyroscope=()',
  'magnetometer=()',
  'microphone=()',
  'payment=()',
  'publickey-credentials-get=()',
  'usb=()',
].join(', ');

const packageContentSecurityPolicy = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "child-src 'none'",
  "frame-src 'none'",
  `frame-ancestors 'self' ${trustedPlatformOrigin}`,
  "font-src 'self' data:",
  "form-action 'none'",
  "img-src 'self' data: blob:",
  "manifest-src 'none'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "webrtc 'block'",
  "worker-src 'none'",
  'sandbox allow-scripts',
].join('; ');

export async function onRequest(context) {
  try {
    return await HandleRequest(context);
  } catch (error) {
    console.error('User game runner request failed.', error);
    return ErrorResponse(503, '遊戲執行環境暫時無法使用。');
  }
}

export async function HandleRequest(context) {
  const { request } = context;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return ErrorResponse(405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const url = new URL(request.url);
  const route = ParseGameRoute(url.pathname);
  if (route === null) {
    return context.next();
  }
  if (route.kind === 'invalid') {
    return ErrorResponse(404, '找不到遊戲。');
  }
  if (route.kind === 'redirect') {
    const location = new URL(route.basePath, url.origin);
    return new Response(null, {
      status: 308,
      headers: BaseHeaders({
        Location: location.href,
        'Cache-Control': 'public, max-age=300',
      }),
    });
  }

  const loadedRelease = await LoadApprovedRelease(
    context.env?.GAME_RELEASE_BUCKET,
    route.gameId,
    route.version,
  );
  if (!loadedRelease) {
    return ErrorResponse(404, '找不到已核准的遊戲版本。');
  }
  const { release } = loadedRelease;

  if (route.kind === 'launcher') {
    const embedOptions = ParseEmbedOptions(url.searchParams);
    if (embedOptions === false) {
      return ErrorResponse(400, '嵌入工作階段參數無效。');
    }
    const rendered = RenderLauncher(release, route.basePath, url.origin, embedOptions);
    const launcherCsp = [
      "default-src 'none'",
      "base-uri 'none'",
      `connect-src ${url.origin}`,
      "form-action 'none'",
      `frame-ancestors 'self' ${trustedPlatformOrigin}`,
      "frame-src 'self'",
      "child-src 'self'",
      "img-src 'self' data:",
      "manifest-src 'self'",
      "object-src 'none'",
      `script-src 'nonce-${rendered.cspNonce}'`,
      `style-src 'nonce-${rendered.cspNonce}'`,
      "worker-src 'self'",
    ].join('; ');
    return BodyResponse(request, rendered.body, {
      headers: DocumentHeaders(launcherCsp, 'text/html; charset=utf-8', 'no-cache'),
    });
  }

  if (route.kind === 'manifest') {
    return BodyResponse(request, RenderManifest(release, route.basePath), {
      headers: ResourceHeaders('application/manifest+json; charset=utf-8', 'public, max-age=300'),
    });
  }

  if (route.kind === 'service-worker') {
    const source = await RenderServiceWorker(release, route.basePath);
    const headers = ResourceHeaders('text/javascript; charset=utf-8', 'no-cache');
    headers.set('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'");
    headers.set('Service-Worker-Allowed', route.basePath);
    return BodyResponse(request, source, { headers });
  }

  if (route.kind === 'icon') {
    const headers = ResourceHeaders('image/svg+xml', 'public, max-age=31536000, immutable');
    headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
    return BodyResponse(request, RenderIcon(release), { headers });
  }

  if (route.kind === 'package') {
    const file = release.files.find((candidate) => candidate.path === route.path);
    if (!file) {
      return ErrorResponse(404, '找不到遊戲檔案。');
    }
    return ServePackageFile(context.env.GAME_RELEASE_BUCKET, request, route, file);
  }

  return ErrorResponse(404, '找不到遊戲。');
}

async function LoadApprovedRelease(bucket, gameId, version) {
  if (!bucket || typeof bucket.get !== 'function') {
    throw new Error('GAME_RELEASE_BUCKET is unavailable.');
  }
  const object = await bucket.get(ReleaseKey(gameId, version));
  if (!object) return null;
  if (!Number.isSafeInteger(object.size) || object.size < 2 || object.size > maxReleaseBytes) {
    return null;
  }

  const source = await object.text();
  if (new TextEncoder().encode(source).byteLength > maxReleaseBytes) return null;
  try {
    const release = ValidateRelease(JSON.parse(source), gameId, version);
    return { release, etag: object.httpEtag ?? object.etag };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ReleaseValidationError) {
      return null;
    }
    throw error;
  }
}

async function ServePackageFile(bucket, request, route, file) {
  const key = PackageKey(route.gameId, route.version, route.path);
  const object = request.method === 'HEAD' && typeof bucket.head === 'function'
    ? await bucket.head(key)
    : await bucket.get(key);
  if (!object
    || object.size !== file.size
    || object.customMetadata?.sha256 !== file.sha256) {
    return ErrorResponse(404, '找不到遊戲檔案。');
  }

  const etag = `"sha256-${file.sha256}"`;
  const headers = PackageHeaders(ContentTypeForPath(file.path), etag, file.size);
  if (IsNotModified(request.headers.get('If-None-Match'), etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(request.method === 'HEAD' ? null : object.body, {
    status: 200,
    headers,
  });
}

function BodyResponse(request, body, init) {
  return new Response(request.method === 'HEAD' ? null : body, init);
}

function BaseHeaders(additional = {}) {
  const headers = new Headers(additional);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Permissions-Policy', commonPermissionsPolicy);
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-DNS-Prefetch-Control', 'off');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return headers;
}

function DocumentHeaders(contentSecurityPolicy, contentType, cacheControl) {
  const headers = ResourceHeaders(contentType, cacheControl);
  headers.set('Content-Security-Policy', contentSecurityPolicy);
  headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  headers.set('Origin-Agent-Cluster', '?1');
  return headers;
}

function ResourceHeaders(contentType, cacheControl) {
  return BaseHeaders({
    'Cache-Control': cacheControl,
    'Content-Type': contentType,
  });
}

function PackageHeaders(contentType, etag, size) {
  const headers = DocumentHeaders(
    packageContentSecurityPolicy,
    contentType,
    'public, max-age=31536000, immutable',
  );
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Content-Length', String(size));
  headers.set('ETag', etag);
  return headers;
}

function ErrorResponse(status, message, additionalHeaders = {}) {
  const headers = BaseHeaders({
    ...additionalHeaders,
    'Cache-Control': 'no-store',
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; sandbox",
  });
  return new Response(message, { status, headers });
}

function IsNotModified(ifNoneMatch, etag) {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(',').some((candidate) => {
    const normalized = candidate.trim();
    return normalized === '*' || normalized === etag || normalized === `W/${etag}`;
  });
}

function ParseEmbedOptions(searchParams) {
  if ([...searchParams.keys()].length === 0) {
    return { embedMode: false, embedSessionNonce: null };
  }
  const keys = [...searchParams.keys()];
  const allowedKeys = new Set(['embed', 'session']);
  if (keys.length !== 2
    || new Set(keys).size !== keys.length
    || keys.some((key) => !allowedKeys.has(key))
    || searchParams.get('embed') !== 'hub') {
    return false;
  }
  const sessionNonce = searchParams.get('session');
  if (typeof sessionNonce !== 'string'
    || sessionNonce.length < 32
    || sessionNonce.length > 128
    || !/^[A-Za-z0-9_-]+$/.test(sessionNonce)) {
    return false;
  }
  return { embedMode: true, embedSessionNonce: sessionNonce };
}
