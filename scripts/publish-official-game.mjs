import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { ContentTypeForPath, IsValidVersion, NormalizePackagePath, PackageKey, ReleaseKey, ValidateRelease } from '../apps/usergamerunner/functions/_lib/release.js';
import { OfficialGameCatalogKey, ValidateOfficialGameCatalog } from '../apps/usergamerunner/functions/_lib/officialCatalog.js';
import { maxGameCatalogBytes, ParseGameCatalogMetadata } from '../apps/rehabtrainerhub/games/gameCatalogMetadata.js';

const root = resolve(import.meta.dirname, '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function ValidatePackageResources(files) {
  if (!files.has('index.html') || files.has('settings.json') || files.has('score.json')) throw new Error('Expected self-contained index.html without settings.json or score.json.');
  for (const [path, bytes] of files) {
    if (!NormalizePackagePath(path)) throw new Error(`Unsafe package path: ${path}`);
    if (!/\.(html|css)$/.test(path)) continue;
    const source = bytes.toString('utf8');
    const references = path.endsWith('.html')
      ? [...source.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1])
      : [...source.matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)].map(match => match[1]);
    for (const reference of references) {
      if (reference.startsWith('data:') || reference.startsWith('#')) continue;
      if (/^(?:[a-z]+:|\/)/i.test(reference)) throw new Error(`External resource in ${path}: ${reference}`);
      const target = posix.normalize(posix.join(posix.dirname(path), reference));
      if (!files.has(target)) throw new Error(`Missing resource in ${path}: ${reference}`);
    }
  }
}

export async function BuildOfficialGameRelease(gameId) {
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  if (!Object.hasOwn(registry, gameId)) throw new Error('Unknown migrated official game.');
  const registered = registry[gameId];
  const { version, rehabTrainer } = JSON.parse(await readFile(resolve(root, 'apps/rehabtrainerhub/games', gameId, 'package.json'), 'utf8'));
  const directory = resolve(root, 'apps/rehabtrainerhub/games', gameId, 'dist');
  const files = new Map();
  for (const path of (await readdir(directory, { recursive: true })).sort()) {
    const absolute = resolve(directory, path);
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) throw new Error('Package symlinks are forbidden.');
    if (stat.isFile()) files.set(path.replaceAll('\\', '/'), await readFile(absolute));
  }
  ValidatePackageResources(files);
  const catalogBytes = files.get('game.json');
  if (!catalogBytes || catalogBytes.length > maxGameCatalogBytes) throw new Error('Expected game-owned game.json in the built package.');
  const catalog = ParseGameCatalogMetadata(JSON.parse(catalogBytes.toString('utf8')), gameId, new Set(files.keys()));
  const entries = [...files].map(([path, bytes]) => ({ path, size: bytes.length, sha256: sha256(bytes), contentType: ContentTypeForPath(path) }));
  const manifest = { schemaVersion: 1, status: 'approved', gameId, version,
    name: catalog.copy['zh-TW'].title, description: catalog.copy['zh-TW'].description,
    entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game',
    capabilities: rehabTrainer?.capabilities ?? ['audio', 'fullscreen', 'pointer', 'touch'], files: entries,
    contentSha256: sha256(JSON.stringify(entries)), approvedAt: new Date().toISOString() };
  ValidateRelease(manifest, gameId, version);
  return { manifest, files, registered };
}

async function GetCloudflareCredentials() {
  let token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    const configPath = process.env.WRANGLER_AUTH_CONFIG || (process.platform === 'win32'
      ? resolve(process.env.APPDATA, 'xdg.config/.wrangler/config/default.toml')
      : resolve(homedir(), '.config/.wrangler/config/default.toml'));
    const source = await readFile(configPath, 'utf8').catch(() => '');
    token = source.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
  }
  if (!token) throw new Error('Set CLOUDFLARE_API_TOKEN or sign in with Wrangler.');
  let account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!account) {
    const response = await fetch('https://api.cloudflare.com/client/v4/accounts', { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Cloudflare account lookup failed (${response.status}); refresh Wrangler login.`);
    const data = await response.json();
    if (data.result?.length !== 1) throw new Error('Set CLOUDFLARE_ACCOUNT_ID explicitly.');
    account = data.result[0].id;
  }
  return { token, account };
}

async function CreateR2Request() {
  const { token, account } = await GetCloudflareCredentials();
  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/rehab-game-releases/objects/`;
  return async (key, options = {}) => {
    const response = await fetch(base + key.split('/').map(encodeURIComponent).join('/'), {
      ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(60000),
    });
    if (response.status === 404 && !options.method) return null;
    if (!response.ok) throw new Error(`R2 ${options.method || 'GET'} failed (${response.status}) for ${key}`);
    return Buffer.from(await response.arrayBuffer());
  };
}

async function VerifyStoredRelease(request, gameId, version, digest) {
  const bytes = await request(ReleaseKey(gameId, version));
  if (!bytes) throw new Error('Official release is unavailable.');
  const release = ValidateRelease(JSON.parse(bytes.toString('utf8')), gameId, version);
  if (release.presentation !== 'game' || release.contentSha256 !== digest) throw new Error('Official release digest mismatch.');
  for (const file of release.files) {
    const stored = await request(PackageKey(gameId, version, file.path));
    if (!stored || stored.length !== file.size || sha256(stored) !== file.sha256) throw new Error(`R2 verification failed: ${file.path}`);
  }
  return release;
}

export async function ActivateOfficialGameVersion(request, gameId, version, { trustedHistory = {} } = {}) {
  const key = OfficialGameCatalogKey(gameId);
  const existing = await request(key);
  const catalog = existing ? ValidateOfficialGameCatalog(JSON.parse(existing.toString('utf8')), gameId)
    : { schemaVersion: 1, gameId, currentVersion: version, releases: {} };
  const history = { ...catalog.releases };
  for (const [releaseVersion, entry] of Object.entries(trustedHistory)) {
    if (Object.hasOwn(history, releaseVersion)) {
      if (history[releaseVersion].contentSha256 !== entry.contentSha256) throw new Error('Immutable official history digest conflict.');
    } else {
      await VerifyStoredRelease(request, gameId, releaseVersion, entry.contentSha256);
      history[releaseVersion] = entry;
    }
  }
  if (!Object.hasOwn(history, version)) throw new Error('Version is not in trusted official history.');
  await VerifyStoredRelease(request, gameId, version, history[version].contentSha256);
  const next = ValidateOfficialGameCatalog({ ...catalog, currentVersion: version, releases: history }, gameId);
  // ponytail: one publisher per game; add a lease before concurrent release/rollback jobs.
  await request(key, { method: 'PUT', body: JSON.stringify(next), headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const readback = await request(key);
  if (!readback || !isDeepStrictEqual(ValidateOfficialGameCatalog(JSON.parse(readback.toString('utf8')), gameId), next)) {
    throw new Error('R2 current version verification failed.');
  }
  return next;
}

export async function PublishRelease(manifest, files, request, { trustedHistory = {} } = {}) {
  const { gameId, version } = manifest;
  ValidateRelease(manifest, gameId, version);
  const existingRelease = await request(ReleaseKey(gameId, manifest.version));
  if (existingRelease) {
    const existing = JSON.parse(existingRelease.toString('utf8'));
    if (existing.status !== 'approved' || existing.contentSha256 !== manifest.contentSha256) throw new Error('Immutable version already exists with different content or status. Choose a new version.');
  }
  for (const [path, bytes] of files) {
    const key = PackageKey(gameId, manifest.version, path);
    const existing = await request(key);
    if (existing && sha256(existing) !== sha256(bytes)) throw new Error(`Refusing to overwrite immutable object: ${key}`);
    if (!existing) await request(key, { method: 'PUT', body: bytes, headers: { 'Content-Type': ContentTypeForPath(path), 'Cache-Control': 'public, max-age=31536000, immutable' } });
    const uploaded = await request(key);
    if (!uploaded || sha256(uploaded) !== sha256(bytes)) throw new Error(`R2 verification failed: ${key}`);
    console.log(`Verified ${key} (${bytes.length} bytes)`);
  }
  // Publish the allowlist last: incomplete uploads cannot become playable.
  if (!existingRelease) await request(ReleaseKey(gameId, manifest.version), { method: 'PUT', body: JSON.stringify(manifest), headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  const published = JSON.parse((await request(ReleaseKey(gameId, manifest.version))).toString('utf8'));
  if (published.contentSha256 !== manifest.contentSha256 || published.status !== 'approved') throw new Error('R2 release verification failed.');
  return ActivateOfficialGameVersion(request, gameId, version, { trustedHistory: {
    ...trustedHistory, [version]: { contentSha256: manifest.contentSha256 },
  } });
}

async function ReadReceiptHistory(gameId) {
  const history = {};
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'docs/releases'], { cwd: root, encoding: 'utf8' }).split('\0');
  for (const path of tracked) {
    if (!path.startsWith(`docs/releases/${gameId}-`) || !path.endsWith('.json')) continue;
    const receipt = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    if (receipt.gameId === gameId && IsValidVersion(receipt.version) && /^[0-9a-f]{64}$/.test(receipt.contentSha256)) {
      history[receipt.version] = { contentSha256: receipt.contentSha256 };
    }
  }
  return history;
}

export async function PublishOfficialGame(gameId, { dryRun = false, activateVersion } = {}) {
  const registry = JSON.parse(await readFile(resolve(root, 'packages/ui/src/officialGameReleases.json'), 'utf8'));
  if (!Object.hasOwn(registry, gameId)) throw new Error('Unknown migrated official game.');
  if (activateVersion) {
    if (dryRun) throw new Error('Activation requires R2 verification; omit --dry-run.');
    const catalog = await ActivateOfficialGameVersion(await CreateR2Request(), gameId, activateVersion, { trustedHistory: await ReadReceiptHistory(gameId) });
    console.log(`Activated ${gameId}@${catalog.currentVersion}: ${registry[gameId].origin}/games/${gameId}/`);
    return catalog;
  }
  const { manifest, files, registered } = await BuildOfficialGameRelease(gameId);
  const receiptDirectory = resolve(root, '.tmp/official-game-releases', gameId, manifest.version);
  await mkdir(receiptDirectory, { recursive: true });
  await writeFile(resolve(receiptDirectory, 'release.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  if (dryRun) { console.log(`Validated ${gameId}@${manifest.version}: ${files.size} files, digest ${manifest.contentSha256}`); return manifest; }
  await PublishRelease(manifest, files, await CreateR2Request(), { trustedHistory: await ReadReceiptHistory(gameId) });
  const launchUrl = `${registered.origin}/games/${gameId}/${manifest.version}/package/index.html`;
  await writeFile(resolve(receiptDirectory, 'published.json'), JSON.stringify({ gameId, version: manifest.version, bucket: 'rehab-game-releases', launchUrl, contentSha256: manifest.contentSha256, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(`Published and verified: ${launchUrl}`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const activationIndex = process.argv.indexOf('--activate-version');
  if (activationIndex >= 0 && !process.argv[activationIndex + 1]) throw new Error('--activate-version requires a version.');
  await PublishOfficialGame(process.argv[2] || 'drawing-defense', { dryRun: process.argv.includes('--dry-run'),
    activateVersion: activationIndex >= 0 ? process.argv[activationIndex + 1] : undefined });
}
