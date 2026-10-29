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
  if (!['api.pcloud.com', 'eapi.pcloud.com'].includes(env.PCLOUD_API_HOST)
    || typeof env.PCLOUD_ACCESS_TOKEN !== 'string' || !/^[\x21-\x7e]+$/.test(env.PCLOUD_ACCESS_TOKEN)
    || typeof root !== 'string' || !root.startsWith('/') || root.length > 1024
    || !rootSegments.every((segment) => /^[A-Za-z0-9][A-Za-z0-9 _-]{0,127}$/.test(segment))
    || sources.some(([bucket]) => ['list', 'get', 'head', 'delete'].some((method) => typeof bucket?.[method] !== 'function'))) {
    log('raw-data-sync refused: configuration');
    throw new Error('Invalid raw data sync configuration.');
  }

  const summary = { scanned: 0, uploaded: 0, alreadySynced: 0, deleted: 0, skipped: 0, failed: 0 };
  const deadline = now() + maximumRunMs;
  const folders = new Map([['', 0]]);
  let consecutiveFailures = 0;
  const HasBudget = () => summary.scanned < maximumFiles && now() < deadline && consecutiveFailures < 3;
  const Request = async (method, body, allowMissing = false) => {
    const remaining = deadline - now();
    if (remaining <= 0) throw new Error('Sync time budget exhausted.');
    const response = await fetchRequest(`https://${env.PCLOUD_API_HOST}/${method}`, {
      method: 'POST', headers: { Authorization: `Bearer ${env.PCLOUD_ACCESS_TOKEN}` },
      body, redirect: 'error', signal: AbortSignal.timeout(Math.min(30000, remaining)),
    });
    if (!response.ok) {
      log(`raw-data-sync pcloud ${method} http=${response.status}`);
      throw new Error('pCloud HTTP error.');
    }
    const result = await response.json();
    if (result?.result !== 0) {
      // 2002: a parent folder is missing, 2005: the folder is missing, 2009: the file is missing.
      if (allowMissing && [2002, 2005, 2009].includes(result?.result)) return null;
      log(`raw-data-sync pcloud ${method} result=${Number.isSafeInteger(result?.result) ? result.result : 'invalid'}`);
      throw new Error('pCloud result error.');
    }
    return result;
  };
  const EnsureFolder = async (segments) => {
    let path = '';
    let folderId = 0;
    for (const segment of segments) {
      path += `/${segment}`;
      if (!folders.has(path)) {
        const result = await Request('createfolderifnotexists', new URLSearchParams({ folderid: String(folderId), name: segment }));
        const id = result.metadata?.folderid;
        if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid pCloud folder metadata.');
        folders.set(path, id);
      }
      folderId = folders.get(path);
    }
    return folderId;
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
          const sha1 = await Digest('SHA-1', bytes);
          const sha256 = await Digest('SHA-256', bytes);
          const segments = [...rootSegments, ...target];
          const filename = segments.pop();
          const path = `/${[...segments, filename].join('/')}`;
          operation = 'existing-checksum';
          const existing = await Request('checksumfile', new URLSearchParams({ path }), true);
          if (MatchesChecksum(existing, object.size, sha1, sha256)) {
            summary.alreadySynced++;
          } else {
            operation = 'folders';
            const folderId = await EnsureFolder(segments);
            const form = new FormData();
            form.append('folderid', String(folderId));
            form.append('nopartial', '1');
            form.append('file', new Blob([bytes], { type: 'text/csv' }), filename);
            operation = 'upload';
            const uploaded = await Request('uploadfile', form);
            const fileId = uploaded.fileids?.[0];
            const metadata = uploaded.metadata?.[0];
            if (uploaded.fileids?.length !== 1 || uploaded.metadata?.length !== 1
              || !Number.isSafeInteger(fileId) || fileId <= 0 || metadata.fileid !== fileId
              || metadata.name !== filename || metadata.size !== object.size) throw new Error('Invalid pCloud upload metadata.');
            summary.uploaded++;
            operation = 'uploaded-checksum';
            const verified = await Request('checksumfile', new URLSearchParams({ fileid: String(fileId) }));
            if (!MatchesChecksum(verified, object.size, sha1, sha256)) throw new Error('pCloud checksum mismatch.');
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

function MatchesChecksum(result, size, sha1, sha256) {
  return result?.metadata?.size === size && typeof result.sha1 === 'string' && result.sha1.toLowerCase() === sha1
    && (!Object.hasOwn(result, 'sha256') || (typeof result.sha256 === 'string' && result.sha256.toLowerCase() === sha256));
}
