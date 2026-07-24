import {
  ErrorResponse,
  JsonResponse,
  OptionsResponse,
  RateLimitResponse,
  RejectDisallowedOrigin,
} from '../../_lib/auth.js';
import {
  GetAuthenticatedUser,
  IsStaffUser,
  WriteAdminAuditEvent,
} from '../../_lib/authorization.js';

const maxAssetBytes = 5 * 1024 * 1024;
const maxMultipartBodyBytes = maxAssetBytes + 64 * 1024;
const immutableCacheControl = 'public, max-age=31536000, immutable';
const imageTypes = new Map([
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export function onRequestOptions({ request, env }) {
  return OptionsResponse(request, env);
}

export async function onRequestPost({ request, env }) {
  const originError = RejectDisallowedOrigin(request, env);
  if (originError) return originError;

  try {
    const user = await GetAuthenticatedUser(request, env);
    if (!user) return ErrorResponse(request, env, 'Unauthorized.', 401);
    if (!IsStaffUser(user)) return ErrorResponse(request, env, 'Forbidden.', 403);

    const rateLimitError = await RateLimitResponse(request, env, 'article-asset-upload', {
      identity: user.id,
      identityOnly: true,
      limit: 12,
      windowSeconds: 60 * 60,
    });
    if (rateLimitError) return rateLimitError;

    const bucket = env.ASSET_BUCKET;
    if (!bucket || typeof bucket.put !== 'function') {
      return ErrorResponse(request, env, 'Asset storage is not configured.', 503);
    }
    const publicBaseUrl = NormalizePublicBaseUrl(env.ASSET_PUBLIC_BASE_URL);
    if (!publicBaseUrl) {
      return ErrorResponse(request, env, 'Asset public URL is not configured.', 503);
    }
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data')) {
      return ErrorResponse(request, env, 'Expected multipart form data.', 415);
    }
    const contentLength = Number(request.headers.get('Content-Length'));
    if (
      !Number.isSafeInteger(contentLength)
      || contentLength <= 0
      || contentLength > maxMultipartBodyBytes
    ) {
      return ErrorResponse(request, env, 'Image must not exceed 5 MB.', 413);
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!IsUploadedFile(file)) {
      return ErrorResponse(request, env, 'An image file is required.', 400);
    }
    const contentType = String(file.type || '').toLowerCase();
    const extension = imageTypes.get(contentType);
    if (!extension) return ErrorResponse(request, env, 'Unsupported image type.', 415);
    if (file.size <= 0 || file.size > maxAssetBytes) {
      return ErrorResponse(request, env, 'Image must be between 1 byte and 5 MB.', 413);
    }

    const key = `articles/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
    const bytes = await file.arrayBuffer();
    await bucket.put(key, bytes, {
      httpMetadata: {
        contentType,
        cacheControl: immutableCacheControl,
      },
      customMetadata: {
        uploadedBy: user.id,
      },
    });
    const url = `${publicBaseUrl}/${key}`;

    await WriteAdminAuditEvent(env, {
      actorUserId: user.id,
      action: 'article_asset.upload',
      targetType: 'asset',
      targetId: key,
      metadata: {
        contentType,
        size: file.size,
      },
    });

    return JsonResponse(request, env, { url, key }, { status: 201 });
  } catch (error) {
    console.error('Unable to upload an article image.', error);
    return ErrorResponse(request, env, 'Unable to upload the article image.', 500);
  }
}

function IsUploadedFile(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && typeof value.arrayBuffer === 'function'
    && Number.isFinite(value.size),
  );
}

function NormalizePublicBaseUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const isLocalHttp = url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !isLocalHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
}
