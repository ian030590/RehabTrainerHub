import { IsValidGameId, IsValidVersion, ReleaseKey, ReleaseValidationError, ValidateRelease, maxReleaseBytes } from './release.js';

export function OfficialGameCatalogKey(gameId) {
  if (!IsValidGameId(gameId)) throw new ReleaseValidationError('Invalid official game identity.');
  return `official-games/${gameId}/current.json`;
}

function HasExactKeys(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value))
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

export function ValidateOfficialGameCatalog(value, gameId) {
  if (!IsValidGameId(gameId) || !HasExactKeys(value, ['schemaVersion', 'gameId', 'currentVersion', 'releases'])
    || value.schemaVersion !== 1 || value.gameId !== gameId || !IsValidVersion(value.currentVersion)
    || !value.releases || typeof value.releases !== 'object' || Array.isArray(value.releases)) {
    throw new ReleaseValidationError('Invalid official game catalog.');
  }
  const entries = Object.entries(value.releases);
  if (!entries.length || entries.length > 4096 || !Object.hasOwn(value.releases, value.currentVersion)
    || entries.some(([version, entry]) => !IsValidVersion(version) || !HasExactKeys(entry, ['contentSha256'])
      || typeof entry.contentSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(entry.contentSha256))) {
    throw new ReleaseValidationError('Invalid official game release history.');
  }
  return value;
}

async function ReadObject(bucket, key, validate) {
  const object = await bucket?.get(key);
  if (!object || object.size > maxReleaseBytes) return null;
  const source = await object.text();
  if (new TextEncoder().encode(source).length > maxReleaseBytes) return null;
  try { return validate(JSON.parse(source)); }
  catch (error) {
    if (error instanceof SyntaxError || error instanceof ReleaseValidationError) return null;
    throw error;
  }
}

export async function ReadOfficialGameCatalog(bucket, gameId) {
  if (!IsValidGameId(gameId)) return null;
  return ReadObject(bucket, OfficialGameCatalogKey(gameId), value => ValidateOfficialGameCatalog(value, gameId));
}

export async function ReadOfficialGameRelease(bucket, gameId, version) {
  const catalog = await ReadOfficialGameCatalog(bucket, gameId);
  const selected = version ?? catalog?.currentVersion;
  if (!catalog || !IsValidVersion(selected) || !Object.hasOwn(catalog.releases, selected)) return null;
  const release = await ReadObject(bucket, ReleaseKey(gameId, selected), value => ValidateRelease(value, gameId, selected));
  return release?.presentation === 'game' && release.runtime.name === 'native'
    && release.contentSha256 === catalog.releases[selected].contentSha256 ? release : null;
}
