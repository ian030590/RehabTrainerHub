const maximumFiles = 200;
const maximumBytes = 25 * 1024 * 1024;
const maximumRunMs = 10 * 60 * 1000;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const subjectPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const rawKinds = new Set(['rounds', 'hand', 'head', 'pose', 'tongue']);

export async function ProcessRawDataSync(env, options = {}) {
  const { fetch: fetchRequest = globalThis.fetch, log = console.log, now = Date.now } = options;
  const root = env.PCLOUD_ROOT_FOLDER ?? '/RehabTrainerHub/raw-data';
  const rootSegments = root === '/' ? [] : typeof root === 'string' ? root.slice(1).split('/') : [];
  const sources = [[env.RAW_DATA, 'RAW_DATA', 'pending/'], [env.OCULOMOTOR_DATA, 'OCULOMOTOR_DATA', 'guests/'],
    [env.OCULOMOTOR_DATA, 'OCULOMOTOR_DATA', 'users/']];
  if (!['https://ewebdav.pcloud.com', 'https://webdav.pcloud.com'].includes(env.PCLOUD_WEBDAV_URL)
    || typeof env.PCLOUD_WEBDAV_USERNAME !== 'string' || !env.PCLOUD_WEBDAV_USERNAME || /[:\p{C}]/u.test(env.PCLOUD_WEBDAV_USERNAME)
    || typeof env.PCLOUD_WEBDAV_PASSWORD !== 'string' || !env.PCLOUD_WEBDAV_PASSWORD || /[\x00-\x1f\x7f-\x9f]/.test(env.PCLOUD_WEBDAV_PASSWORD)
    || typeof root !== 'string' || !root.startsWith('/') || root.length > 1024
    || !rootSegments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(segment))
    || sources.some(([bucket]) => ['list', 'get', 'head', 'delete'].some((method) => typeof bucket?.[method] !== 'function'))) {
    log('raw-data-sync refused: configuration');
    throw new Error('Invalid raw data sync configuration.');
  }

  const summary = { scanned: 0, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: 0, failed: 0 };
  const deadline = now() + maximumRunMs;
  const folders = new Set();
  const authorization = `Basic ${btoa(Array.from(new TextEncoder().encode(`${env.PCLOUD_WEBDAV_USERNAME}:${env.PCLOUD_WEBDAV_PASSWORD}`),
    (byte) => String.fromCharCode(byte)).join(''))}`;
  let consecutiveFailures = 0;
  const HasBudget = () => summary.scanned < maximumFiles && now() < deadline && consecutiveFailures < 3;
  const Request = async (method, path, accepted, body) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error('Sync time budget exhausted.');
    const response = await fetchRequest(`${env.PCLOUD_WEBDAV_URL}${path}`, {
      method, headers: { Authorization: authorization, ...(method === 'PUT' ? { 'Content-Type': 'text/csv; charset=utf-8' } : {}) },
      // Workers reject redirect: 'error'; 'manual' plus the accepted-status check below refuses redirects.
      body, redirect: 'manual', signal: AbortSignal.timeout(Math.min(30000, remaining)),
    });
    if (!accepted.includes(response.status)) {
      log(`raw-data-sync webdav ${method} http=${response.status}`);
      await response.body?.cancel();
      throw new Error('WebDAV HTTP error.');
    }
    if (method !== 'GET') await response.body?.cancel();
    return response;
  };
  const EnsureFolder = async (segments) => {
    let path = '';
    for (const segment of segments) {
      path += `/${encodeURIComponent(segment)}`;
      if (!folders.has(path)) {
        await Request('MKCOL', path, [201, 405]);
        folders.add(path);
      }
    }
  };

  for (const [bucket, label, prefix] of sources) {
    let cursor;
    while (HasBudget()) {
      let page;
      try {
        page = await bucket.list({ prefix, include: ['customMetadata'], limit: maximumFiles - summary.scanned, ...(cursor ? { cursor } : {}) });
      } catch {
        summary.failed++;
        consecutiveFailures++;
        log(`raw-data-sync failed ${label}: list`);
        break;
      }
      for (const listed of page.objects) {
        if (!HasBudget()) break;
        summary.scanned++;
        const target = TargetSegments(listed, prefix);
        if (!target || !Number.isSafeInteger(listed.size) || listed.size < 0 || listed.size > maximumBytes) {
          summary.skipped++;
          log(`raw-data-sync skipped ${label} item=${summary.scanned}: key-or-size`);
          continue;
        }
        let operation = 'read';
        try {
          const object = await bucket.get(listed.key, { onlyIf: { etagMatches: listed.etag } });
          if (!object?.body || !SameObject(listed, object) || object.size > maximumBytes
            || TargetSegments(object, prefix)?.join('/') !== target.join('/')) throw new Error('R2 object changed.');
          const bytes = await object.arrayBuffer();
          if (bytes.byteLength !== object.size) throw new Error('R2 size mismatch.');
          const sha256 = await Digest('SHA-256', bytes);
          const segments = [...rootSegments, ...target];
          const path = `/${segments.map(encodeURIComponent).join('/')}`;
          operation = 'existing-checksum';
          const existing = await Request('GET', path, [200, 404]);
          if (await MatchesRemote(existing, object.size, sha256)) {
            summary.alreadySynced++;
          } else {
            operation = 'folders';
            await EnsureFolder(segments.slice(0, -1));
            operation = 'upload';
            await Request('PUT', path, [200, 201, 204], bytes);
            summary.uploaded++;
            operation = 'uploaded-checksum';
            const verified = await Request('GET', path, [200]);
            if (!await MatchesRemote(verified, object.size, sha256)) throw new Error('WebDAV checksum mismatch.');
          }
          operation = 'delete';
          const current = await bucket.head(listed.key);
          if (now() >= deadline || !SameObject(object, current)
            || TargetSegments(current, prefix)?.join('/') !== target.join('/')) throw new Error('R2 object changed or sync expired.');
          // R2 delete has no precondition option; source writers must keep each record key immutable.
          await bucket.delete(listed.key);
          summary.deleted++;
          consecutiveFailures = 0;
        } catch {
          summary.failed++;
          consecutiveFailures++;
          log(`raw-data-sync failed ${label} item=${summary.scanned}: ${operation}`);
        }
      }
      if (!page.truncated || !HasBudget()) break;
      if (!page.cursor || page.cursor === cursor) {
        summary.failed++;
        log(`raw-data-sync failed ${label}: pagination`);
        break;
      }
      cursor = page.cursor;
    }
  }
  log('raw-data-sync summary', summary);
  return summary;
}

function TargetSegments(object, prefix) {
  if (typeof object.key !== 'string' || !object.key.endsWith('.csv')) return null;
  const parts = object.key.split('/');
  let kind, gameId, subjectId, date, filename;
  if (prefix === 'pending/') {
    if (parts.length !== 6 || parts[0] !== 'pending' || !rawKinds.has(parts[1])) return null;
    [, kind, gameId, subjectId, date, filename] = parts;
  } else {
    if (parts.length !== 3 || `${parts[0]}/` !== prefix || !parts[1]) return null;
    filename = parts[2];
    const metadata = object.customMetadata;
    if (prefix === 'users/') {
      subjectId = metadata?.subjectId;
      date = metadata?.recordedDate;
    } else {
      subjectId = parts[1];
      if (IsRecordedDate(metadata?.recordedDate)) date = metadata.recordedDate;
      else {
        if (!(object.uploaded instanceof Date) || !Number.isFinite(object.uploaded.getTime())) return null;
        date = object.uploaded.toISOString().slice(0, 10);
      }
    }
    kind = 'eye';
    gameId = 'oculomotor-training';
  }
  const recordId = filename.slice(0, -4);
  if (!idPattern.test(gameId) || gameId.length > 128 || !subjectPattern.test(subjectId)
    || !idPattern.test(recordId) || recordId.length > 128 || !IsRecordedDate(date)) return null;
  return [kind, gameId, subjectId, date, filename];
}

function IsRecordedDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsedDate = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date;
}

function SameObject(expected, actual) {
  return actual && typeof expected.etag === 'string' && expected.etag.length > 0
    && actual.etag === expected.etag && actual.size === expected.size && actual.version === expected.version;
}

async function Digest(algorithm, bytes) {
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function MatchesRemote(response, size, sha256) {
  if (response.status !== 200 || Number(response.headers.get('Content-Length')) > maximumBytes) {
    await response.body?.cancel();
    return false;
  }
  const reader = response.body?.getReader();
  const bytes = new Uint8Array(size);
  let offset = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (offset + value.byteLength > size) {
          await reader.cancel();
          return false;
        }
        bytes.set(value, offset);
        offset += value.byteLength;
      }
    } finally {
      reader.releaseLock();
    }
  }
  return offset === size && await Digest('SHA-256', bytes) === sha256;
}
