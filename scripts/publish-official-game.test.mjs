import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function Fixture() {
  const bytes = Buffer.from('<!doctype html><title>Game</title>');
  const files = new Map([['index.html', bytes]]);
  const entries = [{ path: 'index.html', size: bytes.length, sha256: digest(bytes), contentType: 'text/html' }];
  const manifest = { schemaVersion: 1, status: 'approved', gameId: 'drawing-defense', version: '2.0.2',
    name: 'Game', entry: 'index.html', runtime: { name: 'native', major: 1 }, presentation: 'game',
    files: entries, contentSha256: digest(JSON.stringify(entries)) };
  const old = { ...manifest, version: '2.0.1' };
  const catalog = { schemaVersion: 1, gameId: manifest.gameId, currentVersion: old.version,
    releases: { [old.version]: { contentSha256: old.contentSha256 } } };
  const pointer = 'official-games/drawing-defense/current.json';
  const objects = new Map([[pointer, Buffer.from(JSON.stringify(catalog))],
    ['releases/drawing-defense/2.0.1/release.json', Buffer.from(JSON.stringify(old))],
    ['releases/drawing-defense/2.0.1/files/index.html', bytes]]);
  const writes = [];
  const request = async (key, options = {}) => {
    if (options.method === 'PUT') { writes.push(key); objects.set(key, Buffer.from(options.body)); }
    return objects.get(key) ?? null;
  };
  return { manifest, files, catalog, pointer, objects, writes, request };
}

test('publisher verifies assets then manifest before activating current, and retains old approved versions for rollback', async () => {
  const { PublishRelease, ActivateOfficialGameVersion } = await import('./publish-official-game.mjs');
  const fixture = Fixture();
  await PublishRelease(fixture.manifest, fixture.files, fixture.request);
  assert.deepEqual(fixture.writes, ['releases/drawing-defense/2.0.2/files/index.html',
    'releases/drawing-defense/2.0.2/release.json', fixture.pointer]);
  const catalog = JSON.parse(fixture.objects.get(fixture.pointer));
  assert.equal(catalog.currentVersion, '2.0.2');
  assert.deepEqual(Object.keys(catalog.releases), ['2.0.1', '2.0.2']);
  await ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '2.0.1');
  assert.equal(JSON.parse(fixture.objects.get(fixture.pointer)).currentVersion, '2.0.1');
  const pointerBefore = fixture.objects.get(fixture.pointer);
  fixture.objects.set('releases/drawing-defense/9.0.0/release.json', Buffer.from(JSON.stringify({ ...fixture.manifest, version: '9.0.0' })));
  await assert.rejects(ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '9.0.0'), /official|trusted/i);
  assert.deepEqual(fixture.objects.get(fixture.pointer), pointerBefore);
  fixture.objects.set('releases/drawing-defense/2.0.2/release.json', Buffer.from(JSON.stringify({ ...fixture.manifest, status: 'revoked' })));
  await assert.rejects(ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '2.0.2'), /approved/i);
  assert.deepEqual(fixture.objects.get(fixture.pointer), pointerBefore);
});

test('upload failure, corrupted readback and immutable conflicts never change current', async () => {
  const { PublishRelease } = await import('./publish-official-game.mjs');
  for (const failure of ['upload', 'corrupt', 'conflict']) {
    const fixture = Fixture();
    const before = fixture.objects.get(fixture.pointer);
    if (failure === 'conflict') fixture.objects.set('releases/drawing-defense/2.0.2/files/index.html', Buffer.from('different'));
    const request = async (key, options = {}) => {
      if (key.endsWith('/files/index.html') && options.method === 'PUT') {
        if (failure === 'upload') throw new Error('Upload failed');
        if (failure === 'corrupt') return fixture.request(key, { ...options, body: 'corrupt' });
      }
      return fixture.request(key, options);
    };
    await assert.rejects(PublishRelease(fixture.manifest, fixture.files, request), /Upload failed|verification|immutable/i);
    assert.deepEqual(fixture.objects.get(fixture.pointer), before);
    assert.ok(!fixture.writes.includes(fixture.pointer));
  }
});

test('bootstrap accepts receipt digests only after verifying the stored manifest and files', async () => {
  const { ActivateOfficialGameVersion } = await import('./publish-official-game.mjs');
  const fixture = Fixture();
  fixture.objects.delete(fixture.pointer);
  await assert.rejects(ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '2.0.1'), /official|trusted/i);
  await assert.rejects(ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '2.0.1', { trustedHistory: { '2.0.1': { contentSha256: 'f'.repeat(64) } } }), /digest/i);
  assert.equal(fixture.objects.has(fixture.pointer), false);
  await ActivateOfficialGameVersion(fixture.request, 'drawing-defense', '2.0.1', { trustedHistory: fixture.catalog.releases });
  assert.equal(JSON.parse(fixture.objects.get(fixture.pointer)).currentVersion, '2.0.1');
});
