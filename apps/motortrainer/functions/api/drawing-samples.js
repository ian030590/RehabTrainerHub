const maxImageBytes = 1024 * 1024;
const maxRequestBytes = maxImageBytes + 128 * 1024;
const shapes = new Set(['circle', 'cross', 'square', 'triangle', 'vertical-line', 'horizontal-line']);
const uploadTokenHeader = 'x-drawing-upload-token';

export async function onRequestOptions(context) {
  return new Response(null, {
    status: IsAllowedOrigin(context) ? 204 : 403,
    headers: CorsHeaders(context),
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = CorsHeaders(context);
  const webhookUrl = env.DISCORD_DRAWING_WEBHOOK_URL;

  if (!IsAllowedOrigin(context)) {
    return Json({ error: 'Origin is not allowed.' }, 403, headers);
  }

  if (!HasValidUploadToken(request, env)) {
    return Json({ error: 'Upload is not allowed.' }, 403, headers);
  }

  if (!webhookUrl) {
    return Json({ error: 'Discord webhook is not configured.' }, 500, headers);
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return Json({ error: 'Expected multipart/form-data.' }, 415, headers);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
    return Json({ error: 'Upload request is too large.' }, 413, headers);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Json({ error: 'Invalid multipart form data.' }, 400, headers);
  }
  const image = form.get('image');
  const metadataText = form.get('metadata');

  if (!(image instanceof File)) {
    return Json({ error: 'Missing image file.' }, 400, headers);
  }

  if (image.type !== 'image/png') {
    return Json({ error: 'Only PNG image uploads are accepted.' }, 415, headers);
  }

  if (image.size > maxImageBytes) {
    return Json({ error: 'Image is too large.' }, 413, headers);
  }

  const metadata = ParseMetadata(metadataText);
  const filename = CreateSafeFilename(metadata, image.name);
  const discordForm = new FormData();
  discordForm.append('payload_json', JSON.stringify(CreateDiscordPayload(metadata, filename)));
  discordForm.append('files[0]', image, filename);

  let discordWebhookUrl;
  try {
    discordWebhookUrl = CreateDiscordWebhookUrl(webhookUrl);
  } catch {
    return Json({ error: 'Discord webhook URL is invalid.' }, 500, headers);
  }

  let discordResponse;
  try {
    discordResponse = await fetch(discordWebhookUrl, {
      method: 'POST',
      body: discordForm,
    });
  } catch {
    return Json({ error: 'Discord upload request failed.' }, 502, headers);
  }

  if (!discordResponse.ok) {
    return Json(
      { error: 'Discord upload failed.', discordStatus: discordResponse.status },
      502,
      headers,
    );
  }

  return Json({ ok: true, filename }, 201, headers);
}

function CreateDiscordWebhookUrl(webhookUrl) {
  const url = new URL(webhookUrl);
  url.searchParams.set('wait', 'true');
  return url.toString();
}

function ParseMetadata(value) {
  if (typeof value !== 'string' || value.length > 12000) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function CreateSafeFilename(metadata, fallbackName) {
  const rawTarget = typeof metadata.targetShape === 'string' && shapes.has(metadata.targetShape)
    ? metadata.targetShape
    : 'unknown';
  const matched = metadata.matched === true ? 'hit' : 'miss';
  const sampleId = typeof metadata.sampleId === 'string' ? metadata.sampleId : fallbackName.replace(/\.png$/i, '');
  const safeSampleId = SanitizeFilePart(sampleId) || crypto.randomUUID();
  return `drawing_${rawTarget}_${matched}_${safeSampleId}.png`;
}

function CreateDiscordPayload(metadata, filename) {
  const targetShape = SafeText(metadata.targetShape) || 'unknown';
  const recognizedShape = SafeText(metadata.recognizedShape) || 'unrecognized';
  const participant = SafeText(metadata.participantId) || 'Unknown';
  const fields = [
    { name: 'participant', value: participant, inline: true },
    { name: 'target', value: targetShape, inline: true },
    { name: 'recognized', value: recognizedShape, inline: true },
    { name: 'matched', value: metadata.matched === true ? 'true' : 'false', inline: true },
    { name: 'difficulty', value: SafeText(metadata.difficulty) || 'unknown', inline: true },
    { name: 'enemy', value: SafeText(metadata.enemyNumber) || '-', inline: true },
    { name: 'elapsedSec', value: SafeText(metadata.elapsedSeconds) || '-', inline: true },
    { name: 'strokeCount', value: SafeText(metadata.strokeCount) || '-', inline: true },
    { name: 'pointCount', value: SafeText(metadata.pointCount) || '-', inline: true },
  ];

  return {
    username: 'MotorTrainer',
    content: `Drawing sample: ${filename}`,
    embeds: [{
      title: 'Drawing Tower Defense Sample',
      timestamp: SafeTimestamp(metadata.createdAt),
      fields,
    }],
  };
}

function SafeText(value) {
  if (value === null || value === undefined) return '';
  return String(value).slice(0, 256);
}

function SafeTimestamp(value) {
  if (typeof value !== 'string') return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function SanitizeFilePart(value) {
  return String(value).trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}

function Json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function CorsHeaders({ request, env }) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': `content-type, ${uploadTokenHeader}`,
    'Access-Control-Max-Age': '86400',
    vary: 'Origin',
  };

  if (!origin) return headers;

  if (IsOriginAllowed(origin, request, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}

function IsAllowedOrigin({ request, env }) {
  const origin = request.headers.get('Origin');
  if (!origin) return false;

  return IsOriginAllowed(origin, request, env);
}

function IsOriginAllowed(origin, request, env) {
  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || GetAllowedOrigins(env).includes(origin);
}

function GetAllowedOrigins(env) {
  return String(env.DRAWING_UPLOAD_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function HasValidUploadToken(request, env) {
  const token = String(env.DRAWING_UPLOAD_TOKEN || '');
  if (!token) return true;
  return ConstantTimeEqual(request.headers.get(uploadTokenHeader) || '', token);
}

function ConstantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
