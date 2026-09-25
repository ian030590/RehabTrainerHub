import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const bucketName = 'oculomotor-data';

export async function EnsureOculomotorBucket({ accountId, token, fetchImpl = fetch }) {
  if (!accountId || !token) throw new Error('Cloudflare account ID and API token are required.');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/r2/buckets`;
  const headers = { Authorization: `Bearer ${token}` };
  const existing = await fetchImpl(`${url}/${bucketName}`, { headers });
  if (existing.ok) {
    const payload = await existing.json();
    if (!payload.success || payload.result?.name !== bucketName) throw new Error('Unexpected R2 bucket response.');
    return 'existing';
  }
  if (existing.status !== 404) throw new Error(`R2 bucket lookup failed (${existing.status}).`);
  const created = await fetchImpl(url, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: bucketName }),
  });
  const payload = await created.json();
  if (!created.ok || !payload.success || payload.result?.name !== bucketName) {
    if (created.status === 409) {
      const raced = await fetchImpl(`${url}/${bucketName}`, { headers });
      if (raced.ok && (await raced.json()).result?.name === bucketName) return 'existing';
    }
    throw new Error(`R2 bucket creation failed (${created.status}).`);
  }
  return 'created';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await EnsureOculomotorBucket({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    token: process.env.CLOUDFLARE_API_TOKEN,
  });
  console.log(`${bucketName}: ${result}`);
}
