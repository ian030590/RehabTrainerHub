const tokenExpiresInSeconds = 600;

export async function onRequestOptions(context) {
  return new Response(null, {
    status: IsAllowedOrigin(context) ? 204 : 403,
    headers: CorsHeaders(context),
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const headers = CorsHeaders(context);

  if (!IsAllowedOrigin(context)) {
    return Json({ error: 'Origin is not allowed.' }, 403, headers);
  }

  const key = String(env.AZURE_SPEECH_KEY || '').trim();
  const region = String(env.AZURE_SPEECH_REGION || '').trim();

  if (!key || !region) {
    return Json(
      { error: 'Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.' },
      503,
      headers,
    );
  }

  if (!/^[a-z0-9-]+$/i.test(region)) {
    return Json({ error: 'AZURE_SPEECH_REGION is invalid.' }, 500, headers);
  }

  const endpoint = `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`;

  let tokenResponse;
  try {
    tokenResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'Ocp-Apim-Subscription-Key': key,
      },
      body: '',
    });
  } catch {
    return Json({ error: 'Azure Speech token request failed.' }, 502, headers);
  }

  const token = await tokenResponse.text();
  if (!tokenResponse.ok || !token.trim()) {
    return Json(
      { error: 'Azure Speech token request was rejected.', azureStatus: tokenResponse.status },
      502,
      headers,
    );
  }

  return Json({
    token,
    region,
    expiresInSeconds: tokenExpiresInSeconds,
  }, 200, headers);
}

function Json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function CorsHeaders({ request, env }) {
  const origin = request.headers.get('Origin');
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
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
  if (!origin) return true;

  return IsOriginAllowed(origin, request, env);
}

function IsOriginAllowed(origin, request, env) {
  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || GetAllowedOrigins(env).includes(origin);
}

function GetAllowedOrigins(env) {
  return String(env.AZURE_SPEECH_ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
