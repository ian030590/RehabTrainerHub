const maximumFiles = 200;
const maximumScanned = 2000;
const maximumBytes = 25 * 1024 * 1024;
const maximumRunMs = 10 * 60 * 1000;
const progressKey = 'sync-state/raw-data-sync.json';
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const subjectPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const rawKinds = new Set(['rounds', 'hand', 'head', 'pose', 'tongue']);

export async function ProcessRawDataSync(env, options = {}) {
  const { fetch: fetchRequest = globalThis.fetch, log = console.log, now = Date.now } = options;
  const root = env.PCLOUD_ROOT_FOLDER ?? '/RehabTrainerHub/raw-data';
  const rootSegments = root === '/' ? [] : typeof root === 'string' ? root.slice(1).split('/') : [];
  const sources = [[env.RAW_DATA, 'RAW_DATA', 'pending/'], [env.OCULOMOTOR_DATA, 'OCULOMOTOR_DATA', 'guests/'],
    [env.OCULOMOTOR_DATA, 'OCULOMOTOR_DATA', 'users/']];
  if (!['eapi.pcloud.com', 'api.pcloud.com'].includes(env.PCLOUD_API_HOST)
    || typeof env.PCLOUD_ACCESS_TOKEN !== 'string' || !/^[A-Za-z0-9._~+\/-]+=*$/.test(env.PCLOUD_ACCESS_TOKEN)
    || typeof root !== 'string' || !root.startsWith('/') || root.length > 1024
    || !rootSegments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(segment))
    || typeof env.RAW_DATA?.put !== 'function'
    || sources.some(([bucket]) => ['list', 'get', 'head', 'delete'].some((method) => typeof bucket?.[method] !== 'function'))) {
    log('raw-data-sync refused: configuration');
    throw new Error('Invalid raw data sync configuration.');
  }

  const summary = { scanned: 0, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: 0, failed: 0 };
  const deadline = now() + maximumRunMs;
  let progress = { source: 0 };
  try {
    const saved = await env.RAW_DATA.get(progressKey);
    if (saved) {
      progress = JSON.parse(await saved.text());
      if (!progress || !Number.isInteger(progress.source) || progress.source < 0 || progress.source >= sources.length
        || (progress.cursor !== undefined && (typeof progress.cursor !== 'string' || progress.cursor.length > 16384))
        || (progress.after !== undefined && (typeof progress.after !== 'string' || progress.after.length > 1024))) {
        throw new Error('Invalid sync progress.');
      }
    }
  } catch {
    summary.failed++;
    log('raw-data-sync failed RAW_DATA: progress-read');
    log('raw-data-sync summary', summary);
    return summary;
  }
  const initialProgress = JSON.stringify(progress);
  const folders = new Map();
  let consecutiveFailures = 0;
  const HasBudget = () => summary.uploaded + summary.alreadySynced < maximumFiles
    && summary.scanned < maximumScanned && now() < deadline && consecutiveFailures < 3;
  const Request = async (url, init, operation) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error('Sync time budget exhausted.');
    let response;
    try {
      response = await fetchRequest(url, {
        ...init,
        // Workers reject redirect: 'error'; 'manual' plus the accepted-status check below refuses redirects.
        redirect: 'manual', signal: AbortSignal.timeout(Math.min(30000, remaining)),
      });
    } catch {
      throw new Error('pCloud request failed.', { cause: 'service' });
    }
    if (response.status !== 200) {
      log(`raw-data-sync pcloud ${operation} http=${response.status}`);
      await response.body?.cancel();
      throw new Error('pCloud HTTP error.', { cause: response.status >= 500 || response.status === 401
        || response.status === 403 || response.status === 408 || response.status === 429
        || (response.status >= 300 && response.status < 400) ? 'service' : 'object' });
    }
    return response;
  };
  const Api = async (method, parameters, allowMissing = false) => {
    const response = await Request(`https://${env.PCLOUD_API_HOST}/${method}`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.PCLOUD_ACCESS_TOKEN}` },
      body: parameters instanceof FormData ? parameters : new URLSearchParams(parameters),
    }, method);
    let data;
    try { data = await ReadApiResponse(response); }
    catch { throw new Error('Invalid pCloud response.', { cause: 'service' }); }
    if (!Number.isInteger(data?.result)) throw new Error('Invalid pCloud result.', { cause: 'service' });
    if (allowMissing && [2002, 2009].includes(data.result)) return null;
    if (data.result !== 0) {
      log(`raw-data-sync pcloud ${method} result=${data.result}`);
      throw new Error('pCloud API error.', { cause: data.result < 2000 || [2000, 2003, 2008, 2041, 2094].includes(data.result)
        || data.result >= 4000 ? 'service' : 'object' });
    }
    return data;
  };
  const ReadRemote = async (path, allowMissing = false) => {
    const link = await Api('getfilelink', { path }, allowMissing);
    if (!link) return null;
    const host = Array.isArray(link.hosts) ? link.hosts[0] : undefined;
    if (typeof host !== 'string' || host.length > 253
      || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+pcloud\.com$/i.test(host)
      || typeof link.path !== 'string' || !link.path.startsWith('/') || link.path.startsWith('//')
      || /[\\#\p{C}]/u.test(link.path)) throw new Error('Invalid pCloud download link.', { cause: 'service' });
    return Request(`https://${host}${link.path}`, { method: 'GET' }, 'download');
  };
  const EnsureFolder = async (segments) => {
    let path = '';
    let folderId = 0;
    for (const segment of segments) {
      path += `/${segment}`;
      if (!folders.has(path)) {
        const { metadata } = await Api('createfolderifnotexists', { path });
        if (metadata?.isfolder !== true || !Number.isSafeInteger(metadata.folderid) || metadata.folderid <= 0
          || metadata.name !== segment) throw new Error('Invalid pCloud folder.');
        folders.set(path, metadata.folderid);
      }
      folderId = folders.get(path);
    }
    return folderId;
  };

  const firstSource = progress.source;
  for (let index = 0; index < sources.length; index++) {
    const source = (firstSource + index) % sources.length;
    const [bucket, label, prefix] = sources[source];
    let { cursor, after } = progress;
    while (HasBudget()) {
      let page;
      try {
        page = await bucket.list({ prefix, include: ['customMetadata'],
          limit: Math.min(maximumFiles - summary.uploaded - summary.alreadySynced, maximumScanned - summary.scanned),
          ...(cursor ? { cursor } : {}) });
      } catch {
        summary.failed++;
        consecutiveFailures++;
        log(`raw-data-sync failed ${label}: list`);
        progress = { source: (source + 1) % sources.length };
        break;
      }
      for (const listed of page.objects) {
        if (after && listed.key <= after) continue;
        if (!HasBudget()) break;
        // Keep the page cursor and last processed key so a mid-page stop does not skip untouched files.
        progress = { source, ...(cursor ? { cursor } : {}), after: listed.key };
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
          const path = `/${segments.join('/')}`;
          operation = 'existing-checksum';
          const existing = await ReadRemote(path, true);
          if (existing && await MatchesRemote(existing, object.size, sha256)) {
            summary.alreadySynced++;
          } else {
            if (existing) {
              operation = 'conflict';
              throw new Error('Archive conflict.');
            }
            operation = 'folders';
            const folderId = await EnsureFolder(segments.slice(0, -1));
            operation = 'upload';
            const form = new FormData();
            form.append('path', `/${segments.slice(0, -1).join('/')}`);
            form.append('renameifexists', '1');
            form.append('nopartial', '1');
            form.append('file', new Blob([bytes], { type: 'text/csv; charset=utf-8' }), segments.at(-1));
            const uploaded = await Api('uploadfile', form);
            const metadata = uploaded.metadata?.[0];
            // renameifexists protects the archive; a renamed copy cannot authorize deleting the source.
            if (!Array.isArray(uploaded.metadata) || uploaded.metadata.length !== 1 || metadata?.isfolder !== false
              || metadata.name !== segments.at(-1) || metadata.size !== object.size || metadata.parentfolderid !== folderId
              || !Number.isSafeInteger(metadata.fileid) || metadata.fileid <= 0) throw new Error('pCloud upload conflict.');
            summary.uploaded++;
            operation = 'uploaded-checksum';
            const verified = await ReadRemote(path);
            if (!await MatchesRemote(verified, object.size, sha256)) throw new Error('pCloud checksum mismatch.');
          }
          operation = 'delete';
          const current = await bucket.head(listed.key);
          if (now() >= deadline || !SameObject(object, current)
            || TargetSegments(current, prefix)?.join('/') !== target.join('/')) throw new Error('R2 object changed or sync expired.');
          // R2 delete has no precondition option; source writers must keep each record key immutable.
          await bucket.delete(listed.key);
          summary.deleted++;
          consecutiveFailures = 0;
        } catch (error) {
          summary.failed++;
          consecutiveFailures = error?.cause === 'service' ? consecutiveFailures + 1 : 0;
          log(`raw-data-sync failed ${label} item=${summary.scanned}: ${operation}`);
        }
      }
      if (!HasBudget()) break;
      if (!page.truncated) {
        progress = { source: (source + 1) % sources.length };
        break;
      }
      if (!page.cursor || page.cursor === cursor) {
        summary.failed++;
        log(`raw-data-sync failed ${label}: pagination`);
        progress = { source: (source + 1) % sources.length };
        break;
      }
      cursor = page.cursor;
      after = undefined;
      progress = { source, cursor };
    }
    if (!HasBudget()) break;
  }
  if (JSON.stringify(progress) !== initialProgress) {
    try { await env.RAW_DATA.put(progressKey, JSON.stringify(progress), { httpMetadata: { contentType: 'application/json' } }); }
    catch {
      summary.failed++;
      log('raw-data-sync failed RAW_DATA: progress-write');
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
    kind = prefix === 'guests/' ? 'guest-eye' : 'eye';
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

async function ReadApiResponse(response) {
  const maximumResponseBytes = 64 * 1024;
  if (Number(response.headers.get('Content-Length')) > maximumResponseBytes) {
    await response.body?.cancel();
    throw new Error('pCloud response too large.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty pCloud response.');
  const bytes = new Uint8Array(maximumResponseBytes);
  let offset = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > maximumResponseBytes) {
        await reader.cancel();
        throw new Error('pCloud response too large.');
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, offset)));
  } finally {
    reader.releaseLock();
  }
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
    } catch {
      throw new Error('pCloud read failed.', { cause: 'service' });
    } finally {
      reader.releaseLock();
    }
  }
  return offset === size && await Digest('SHA-256', bytes) === sha256;
}
