import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { CreateSignedValue, GetSessionSecret } from './auth.js';

export function CreateMemoryBucket() {
  const objects = new Map();
  return {
    objects,
    async put(key, text, options) {
      if (objects.has(key) && options?.onlyIf?.etagDoesNotMatch === '*') return null;
      objects.set(key, { text, customMetadata: options.customMetadata, options });
      return { key };
    },
    async get(key) {
      const object = objects.get(key);
      return object ? { ...object, text: async () => object.text } : null;
    },
  };
}

export function CreateRawDataEnvironment(gameId = 'motor-cortex-rehab', capabilities = ['hand-tracking']) {
  const sqlite = new DatabaseSync(':memory:');
  const migrations = new URL('../../migrations/', import.meta.url);
  for (const name of readdirSync(migrations).filter(name => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(name, migrations), 'utf8'));
  }
  const database = { prepare(sql) {
    const statement = sqlite.prepare(sql);
    let bindings = [];
    const wrapper = {
      bind(...values) { bindings = values; return wrapper; },
      async first() { return statement.get(...bindings) ?? null; },
      async all() { return { results: statement.all(...bindings) }; },
      async run() { return { meta: { changes: Number(statement.run(...bindings).changes) } }; },
    };
    return wrapper;
  }, async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  } };
  const files = [{ path: 'index.html', size: 1, sha256: 'a'.repeat(64), contentType: 'text/html; charset=utf-8' }];
  const release = { schemaVersion: 1, status: 'approved', gameId, version: '2.0.0', name: 'Fixture',
    entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game', capabilities, files,
    contentSha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') };
  const env = { AUTH_SESSION_SECRET: 'raw-data-tests-0123456789abcdef0123456789', ANONYMOUS_RECORDS_ENABLED: '1',
    REHAB_DB: database, RAW_DATA: CreateMemoryBucket(), GAME_RELEASE_BUCKET: { async get(key) {
      const value = key === `official-games/${gameId}/current.json`
        ? { schemaVersion: 1, gameId, currentVersion: release.version, releases: { [release.version]: { contentSha256: release.contentSha256 } } }
        : key === `releases/${gameId}/${release.version}/release.json` ? release : null;
      return value && { text: async () => JSON.stringify(value), json: async () => value, size: Buffer.byteLength(JSON.stringify(value)) };
    } } };
  return { env, sqlite, release, async session(userId = null, subjectId = crypto.randomUUID()) {
    const claims = { purpose: 'official-game-result', gameId, version: release.version,
      recordId: crypto.randomUUID(), subjectId, userId, contentSha256: release.contentSha256 };
    const token = await CreateSignedValue(claims, GetSessionSecret(env), 86400);
    return { ...claims, token };
  } };
}
