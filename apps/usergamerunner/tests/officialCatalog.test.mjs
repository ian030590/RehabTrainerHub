import assert from 'node:assert/strict';
import test from 'node:test';
import { HandleRequest } from '../functions/[[path]].js';

const gameId = 'drawing-defense';
const digest = 'a'.repeat(64);
function Fixture() {
  const catalog = { schemaVersion: 1, gameId, currentVersion: '2.0.2', releases: {
    '2.0.1': { contentSha256: digest }, '2.0.2': { contentSha256: digest },
  } };
  const release = version => ({ schemaVersion: 1, status: 'approved', gameId, version,
    name: 'Game', runtime: { name: 'native', major: 1 }, presentation: 'game', entry: 'index.html',
    contentSha256: digest, files: [{ path: 'index.html', size: 10, sha256: digest }] });
  const objects = new Map([['official-games/drawing-defense/current.json', catalog],
    ...['2.0.1', '2.0.2', '9.0.0'].map(version => [`releases/${gameId}/${version}/release.json`, release(version)])]);
  const bucket = { get: async key => {
    const value = objects.get(key);
    if (!value) return null;
    const source = typeof value === 'string' ? value : JSON.stringify(value);
    return { size: Buffer.byteLength(source), text: async () => source };
  } };
  return { catalog, objects, bucket };
}

test('official catalog permits approved history independently of current and rejects untrusted or revoked releases', async () => {
  const { ReadOfficialGameRelease, ValidateOfficialGameCatalog } = await import('../functions/_lib/officialCatalog.js');
  const fixture = Fixture();
  assert.equal((await ReadOfficialGameRelease(fixture.bucket, gameId)).version, '2.0.2');
  fixture.catalog.currentVersion = '2.0.1';
  assert.equal((await ReadOfficialGameRelease(fixture.bucket, gameId)).version, '2.0.1');
  assert.equal((await ReadOfficialGameRelease(fixture.bucket, gameId, '2.0.2')).version, '2.0.2');
  assert.equal(await ReadOfficialGameRelease(fixture.bucket, gameId, '9.0.0'), null);
  fixture.objects.get(`releases/${gameId}/2.0.2/release.json`).status = 'revoked';
  assert.equal(await ReadOfficialGameRelease(fixture.bucket, gameId, '2.0.2'), null);
  fixture.objects.get(`releases/${gameId}/2.0.1/release.json`).contentSha256 = 'b'.repeat(64);
  assert.equal(await ReadOfficialGameRelease(fixture.bucket, gameId), null);
  for (const invalid of [{ ...fixture.catalog, gameId: 'other' }, { ...fixture.catalog, currentVersion: '9.0.0' },
    { ...fixture.catalog, releases: [] }, { ...fixture.catalog, releases: { '../bad': { contentSha256: digest } } },
    { ...fixture.catalog, source: 'https://other.example/' }]) {
    assert.throws(() => ValidateOfficialGameCatalog(invalid, gameId));
  }
  fixture.objects.set('official-games/drawing-defense/current.json', '{broken');
  assert.equal(await ReadOfficialGameRelease(fixture.bucket, gameId), null);
  await assert.rejects(ReadOfficialGameRelease({ get: async () => { throw new Error('R2 offline'); } }, gameId), /R2 offline/);
});

test('stable official entry resolves current without caching and fails closed when approval is removed', async () => {
  const fixture = Fixture();
  const request = (path, method = 'GET') => HandleRequest({ request: new Request(`https://runner.example${path}`, { method }), env: { GAME_RELEASE_BUCKET: fixture.bucket } });
  for (const method of ['GET', 'HEAD']) {
    const response = await request(`/games/${gameId}/`, method);
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), `/games/${gameId}/2.0.2/`);
    assert.match(response.headers.get('Cache-Control'), /no-store/);
  }
  fixture.catalog.currentVersion = '2.0.1';
  assert.equal((await request(`/games/${gameId}/`)).headers.get('Location'), `/games/${gameId}/2.0.1/`);
  fixture.objects.get(`releases/${gameId}/2.0.1/release.json`).status = 'revoked';
  assert.equal((await request(`/games/${gameId}/`)).status, 404);
  assert.equal((await request(`/games/${gameId}/`, 'POST')).status, 405);
  for (const path of ['/games/%2e%2e%2f/', `/games/${gameId}/current/package/index.html`]) assert.equal((await request(path)).status, 404);
});
