import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { GetCloudflareCredentials } from './cloudflare-credentials.mjs';

const bucketName = 'oculomotor-data';

export async function CleanupOculomotorCsv({ apply = false, bucket, getCredentials = GetCloudflareCredentials,
  fetchImpl = fetch, sleep = setTimeout, log = console.log } = {}) {
  if (bucket !== undefined && bucket !== bucketName || apply && bucket !== bucketName) {
    throw new Error('Deletion requires --apply --bucket oculomotor-data; no other bucket is allowed.');
  }
  const { token, account } = await getCredentials();
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/r2/buckets/${bucketName}/objects`;
  const stats = { scanned: 0, bytes: 0, deleted: 0, deletedBytes: 0, prefixes: Object.create(null) };
  const request = async (url, method) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(url, { method, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(60000), redirect: 'error' });
      } catch {
        if (attempt === 3) throw new Error(`R2 ${method} failed after 4 attempts.`);
      }
      if (response?.ok) {
        let data;
        try { data = await response.json(); }
        catch {
          // A 2xx delete is final even without the usual JSON envelope; only listing needs the body.
          if (method === 'DELETE') return null;
          throw new Error(`R2 ${method} returned an invalid response.`);
        }
        if (data.success !== true) throw new Error(`R2 ${method} returned an unsuccessful response.`);
        return data;
      }
      if (response && response.status !== 429 && response.status < 500) throw new Error(`R2 ${method} failed (${response.status}).`);
      if (attempt === 3) throw new Error(`R2 ${method} failed (${response?.status ?? 'network'}) after 4 attempts.`);
      const retryAfter = Number(response?.headers.get('Retry-After'));
      await sleep(Math.max(500 * 2 ** attempt, Math.min(Number.isFinite(retryAfter) ? retryAfter * 1000 : 0, 30000)));
    }
  };
  let cursor;
  const cursors = new Set();
  try {
    while (true) {
      const url = new URL(base);
      url.searchParams.set('per_page', '1000');
      if (cursor) url.searchParams.set('cursor', cursor);
      const data = await request(url.href, 'GET');
      if (!Array.isArray(data.result) || data.result.some(object => typeof object.key !== 'string'
        || !Number.isSafeInteger(object.size) || object.size < 0)) throw new Error('R2 list returned an invalid response.');
      if (data.result.some(object => object.key.split('/').some(segment => segment === '.' || segment === '..'))) {
        throw new Error('R2 key contains an unsafe path segment; cleanup stopped.');
      }
      const nextCursor = data.result_info?.cursor;
      const truncated = data.result_info?.is_truncated;
      if (truncated === true && (!nextCursor || typeof nextCursor !== 'string' || cursors.has(nextCursor))) throw new Error('R2 cursor did not advance.');
      for (const object of data.result) {
        const prefix = object.key.includes('/') ? `${object.key.split('/')[0]}/` : '(root)';
        stats.prefixes[prefix] ??= { count: 0, bytes: 0 };
        stats.prefixes[prefix].count += 1; stats.prefixes[prefix].bytes += object.size;
        stats.scanned += 1; stats.bytes += object.size;
      }
      if (apply) {
        for (let offset = 0; offset < data.result.length; offset += 8) {
          const results = await Promise.allSettled(data.result.slice(offset, offset + 8).map(async object => {
            await request(`${base}/${object.key.split('/').map(encodeURIComponent).join('/')}`, 'DELETE');
            stats.deleted += 1; stats.deletedBytes += object.size;
          }));
          const failure = results.find(result => result.status === 'rejected');
          if (failure) throw failure.reason;
        }
      }
      if (truncated === false || !nextCursor && truncated !== true) break;
      if (typeof nextCursor !== 'string' || cursors.has(nextCursor)) throw new Error('R2 cursor did not advance.');
      cursors.add(nextCursor);
      cursor = nextCursor;
    }
  } finally {
    let otherPrefix = 0;
    for (const [prefix, counts] of Object.entries(stats.prefixes)) {
      // Unrecognized prefixes can themselves contain identifiers, so only standard names are printed.
      const label = ['guests/', 'users/', 'checksums/', 'receipts/', '(root)'].includes(prefix) ? prefix : `(other prefix ${++otherPrefix})`;
      log(`${label}: count=${counts.count}, bytes=${counts.bytes}`);
    }
    log(`${apply ? 'Apply' : 'Dry run'}: scanned=${stats.scanned}, bytes=${stats.bytes}, deleted=${stats.deleted}, deletedBytes=${stats.deletedBytes}`);
  }
  return stats;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let bucket;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--bucket' && args[i + 1] && !args[i + 1].startsWith('--')) bucket = args[++i];
    else if (!['--apply', '--dry-run'].includes(args[i])) throw new Error('Use --dry-run (default) or --apply --bucket oculomotor-data.');
  }
  if (args.includes('--apply') && args.includes('--dry-run')) throw new Error('Choose --dry-run or --apply.');
  try { await CleanupOculomotorCsv({ apply: args.includes('--apply'), bucket }); }
  catch { console.error('R2 cleanup stopped. Review partial counts and credentials, then run dry run again.'); process.exitCode = 1; }
}
